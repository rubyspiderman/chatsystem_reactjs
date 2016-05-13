# -*- coding: utf-8 -*-
# Copyright 2014, 2015 OpenMarket Ltd
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

from twisted.internet import defer

from synapse.api.errors import StoreError

from ._base import SQLBaseStore
from synapse.util.caches.descriptors import cachedInlineCallbacks
from .engines import PostgresEngine, Sqlite3Engine

import collections
import logging

logger = logging.getLogger(__name__)


OpsLevel = collections.namedtuple(
    "OpsLevel",
    ("ban_level", "kick_level", "redact_level",)
)


class RoomStore(SQLBaseStore):

    @defer.inlineCallbacks
    def store_room(self, room_id, room_creator_user_id, is_public):
        """Stores a room.

        Args:
            room_id (str): The desired room ID, can be None.
            room_creator_user_id (str): The user ID of the room creator.
            is_public (bool): True to indicate that this room should appear in
            public room lists.
        Raises:
            StoreError if the room could not be stored.
        """
        try:
            yield self._simple_insert(
                RoomsTable.table_name,
                {
                    "room_id": room_id,
                    "creator": room_creator_user_id,
                    "is_public": is_public,
                },
                desc="store_room",
            )
        except Exception as e:
            logger.error("store_room with room_id=%s failed: %s", room_id, e)
            raise StoreError(500, "Problem creating room.")

    def get_room(self, room_id):
        """Retrieve a room.

        Args:
            room_id (str): The ID of the room to retrieve.
        Returns:
            A namedtuple containing the room information, or an empty list.
        """
        return self._simple_select_one(
            table=RoomsTable.table_name,
            keyvalues={"room_id": room_id},
            retcols=RoomsTable.fields,
            desc="get_room",
            allow_none=True,
        )

    def get_public_room_ids(self):
        return self._simple_select_onecol(
            table="rooms",
            keyvalues={
                "is_public": True,
            },
            retcol="room_id",
            desc="get_public_room_ids",
        )

    @defer.inlineCallbacks
    def get_rooms(self, is_public):
        """Retrieve a list of all public rooms.

        Args:
            is_public (bool): True if the rooms returned should be public.
        Returns:
            A list of room dicts containing at least a "room_id" key, a
            "topic" key if one is set, and a "name" key if one is set
        """

        def f(txn):
            def subquery(table_name, column_name=None):
                column_name = column_name or table_name
                return (
                    "SELECT %(table_name)s.event_id as event_id, "
                    "%(table_name)s.room_id as room_id, %(column_name)s "
                    "FROM %(table_name)s "
                    "INNER JOIN current_state_events as c "
                    "ON c.event_id = %(table_name)s.event_id " % {
                        "column_name": column_name,
                        "table_name": table_name,
                    }
                )

            sql = (
                "SELECT"
                "    r.room_id,"
                "    max(n.name),"
                "    max(t.topic),"
                "    max(v.history_visibility),"
                "    max(g.guest_access)"
                " FROM rooms AS r"
                " LEFT JOIN (%(topic)s) AS t ON t.room_id = r.room_id"
                " LEFT JOIN (%(name)s) AS n ON n.room_id = r.room_id"
                " LEFT JOIN (%(history_visibility)s) AS v ON v.room_id = r.room_id"
                " LEFT JOIN (%(guest_access)s) AS g ON g.room_id = r.room_id"
                " WHERE r.is_public = ?"
                " GROUP BY r.room_id" % {
                    "topic": subquery("topics", "topic"),
                    "name": subquery("room_names", "name"),
                    "history_visibility": subquery("history_visibility"),
                    "guest_access": subquery("guest_access"),
                }
            )

            txn.execute(sql, (is_public,))

            rows = txn.fetchall()

            for i, row in enumerate(rows):
                room_id = row[0]
                aliases = self._simple_select_onecol_txn(
                    txn,
                    table="room_aliases",
                    keyvalues={
                        "room_id": room_id
                    },
                    retcol="room_alias",
                )

                rows[i] = list(row) + [aliases]

            return rows

        rows = yield self.runInteraction(
            "get_rooms", f
        )

        ret = [
            {
                "room_id": r[0],
                "name": r[1],
                "topic": r[2],
                "world_readable": r[3] == "world_readable",
                "guest_can_join": r[4] == "can_join",
                "aliases": r[5],
            }
            for r in rows
            if r[5]  # We only return rooms that have at least one alias.
        ]

        defer.returnValue(ret)

    def _store_room_topic_txn(self, txn, event):
        if hasattr(event, "content") and "topic" in event.content:
            self._simple_insert_txn(
                txn,
                "topics",
                {
                    "event_id": event.event_id,
                    "room_id": event.room_id,
                    "topic": event.content["topic"],
                },
            )

            self._store_event_search_txn(
                txn, event, "content.topic", event.content["topic"]
            )

    def _store_room_name_txn(self, txn, event):
        if hasattr(event, "content") and "name" in event.content:
            self._simple_insert_txn(
                txn,
                "room_names",
                {
                    "event_id": event.event_id,
                    "room_id": event.room_id,
                    "name": event.content["name"],
                }
            )

            self._store_event_search_txn(
                txn, event, "content.name", event.content["name"]
            )

    def _store_room_message_txn(self, txn, event):
        if hasattr(event, "content") and "body" in event.content:
            self._store_event_search_txn(
                txn, event, "content.body", event.content["body"]
            )

    def _store_history_visibility_txn(self, txn, event):
        self._store_content_index_txn(txn, event, "history_visibility")

    def _store_guest_access_txn(self, txn, event):
        self._store_content_index_txn(txn, event, "guest_access")

    def _store_content_index_txn(self, txn, event, key):
        if hasattr(event, "content") and key in event.content:
            sql = (
                "INSERT INTO %(key)s"
                " (event_id, room_id, %(key)s)"
                " VALUES (?, ?, ?)" % {"key": key}
            )
            txn.execute(sql, (
                event.event_id,
                event.room_id,
                event.content[key]
            ))

    def _store_event_search_txn(self, txn, event, key, value):
        if isinstance(self.database_engine, PostgresEngine):
            sql = (
                "INSERT INTO event_search (event_id, room_id, key, vector)"
                " VALUES (?,?,?,to_tsvector('english', ?))"
            )
        elif isinstance(self.database_engine, Sqlite3Engine):
            sql = (
                "INSERT INTO event_search (event_id, room_id, key, value)"
                " VALUES (?,?,?,?)"
            )
        else:
            # This should be unreachable.
            raise Exception("Unrecognized database engine")

        txn.execute(sql, (event.event_id, event.room_id, key, value,))

    @cachedInlineCallbacks()
    def get_room_name_and_aliases(self, room_id):
        def f(txn):
            sql = (
                "SELECT event_id FROM current_state_events "
                "WHERE room_id = ? "
            )

            sql += " AND ((type = 'm.room.name' AND state_key = '')"
            sql += " OR type = 'm.room.aliases')"

            txn.execute(sql, (room_id,))
            results = self.cursor_to_dict(txn)

            return self._parse_events_txn(txn, results)

        events = yield self.runInteraction("get_room_name_and_aliases", f)

        name = None
        aliases = []

        for e in events:
            if e.type == 'm.room.name':
                if 'name' in e.content:
                    name = e.content['name']
            elif e.type == 'm.room.aliases':
                if 'aliases' in e.content:
                    aliases.extend(e.content['aliases'])

        defer.returnValue((name, aliases))


class RoomsTable(object):
    table_name = "rooms"

    fields = [
        "room_id",
        "is_public",
        "creator"
    ]
