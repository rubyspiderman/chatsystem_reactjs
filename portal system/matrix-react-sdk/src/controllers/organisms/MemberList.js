/*
Copyright 2015 OpenMarket Ltd

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

var MatrixClientPeg = require("../../MatrixClientPeg");
var Modal = require("../../Modal");
var sdk = require('../../index');

var INITIAL_LOAD_NUM_MEMBERS = 50;

module.exports = {
    getInitialState: function() {
        if (!this.props.roomId) return { members: [] };
        var cli = MatrixClientPeg.get();
        var room = cli.getRoom(this.props.roomId);
        if (!room) return { members: [] };

        this.memberDict = this.getMemberDict();

        var members = this.roomMembers(INITIAL_LOAD_NUM_MEMBERS);
        return {
            members: members
        };
    },

    componentWillMount: function() {
        var cli = MatrixClientPeg.get();
        cli.on("RoomState.members", this.onRoomStateMember);
        cli.on("Room", this.onRoom); // invites
    },

    componentWillUnmount: function() {
        if (MatrixClientPeg.get()) {
            MatrixClientPeg.get().removeListener("Room", this.onRoom);
            MatrixClientPeg.get().removeListener("RoomState.members", this.onRoomStateMember);
            MatrixClientPeg.get().removeListener("User.presence", this.userPresenceFn);
        }
    },

    componentDidMount: function() {
        var self = this;

        // Lazy-load in more than the first N members
        setTimeout(function() {
            if (!self.isMounted()) return;
            self.setState({
                members: self.roomMembers()
            });
        }, 50);

        // Attach a SINGLE listener for global presence changes then locate the
        // member tile and re-render it. This is more efficient than every tile
        // evar attaching their own listener.
        function updateUserState(event, user) {
            // XXX: evil hack to track the age of this presence info.
            // this should be removed once syjs-28 is resolved in the JS SDK itself.
            user.lastPresenceTs = Date.now();

            var tile = self.refs[user.userId];

            if (tile) {
                self._updateList(); // reorder the membership list
            }
        }
        // FIXME: we should probably also reset 'lastActiveAgo' to zero whenever
        // we see a typing notif from a user, as we don't get presence updates for those.
        MatrixClientPeg.get().on("User.presence", updateUserState);
        this.userPresenceFn = updateUserState;
    },
    // Remember to set 'key' on a MemberList to the ID of the room it's for
    /*componentWillReceiveProps: function(newProps) {
    },*/

    onRoom: function(room) {
        if (room.roomId !== this.props.roomId) {
            return;
        }
        // We listen for room events because when we accept an invite
        // we need to wait till the room is fully populated with state
        // before refreshing the member list else we get a stale list.
        this._updateList();
    },

    onRoomStateMember: function(ev, state, member) {
        this._updateList();
    },

    _updateList: function() {
        this.memberDict = this.getMemberDict();

        var self = this;
        this.setState({
            members: self.roomMembers()
        });
    },

    onInvite: function(inputText) {
        var ErrorDialog = sdk.getComponent("organisms.ErrorDialog");
        var self = this;
        // sanity check the input
        inputText = inputText.trim(); // react requires es5-shim so we know trim() exists
        if (inputText[0] !== '@' || inputText.indexOf(":") === -1) {
            console.error("Bad user ID to invite: %s", inputText);
            Modal.createDialog(ErrorDialog, {
                title: "Invite Error",
                description: "Malformed user ID. Should look like '@localpart:domain'"
            });
            return;
        }
        self.setState({
            inviting: true
        });
        console.log("Invite %s to %s", inputText, this.props.roomId);
        MatrixClientPeg.get().invite(this.props.roomId, inputText).done(
        function(res) {
            console.log("Invited");
            self.setState({
                inviting: false
            });
        }, function(err) {
            console.error("Failed to invite: %s", JSON.stringify(err));
            Modal.createDialog(ErrorDialog, {
                title: "Server error whilst inviting",
                description: err.message
            });
            self.setState({
                inviting: false
            });
        });
    },

    getMemberDict: function() {
        if (!this.props.roomId) return {};
        var cli = MatrixClientPeg.get();
        var room = cli.getRoom(this.props.roomId);
        if (!room) return {};

        var all_members = room.currentState.members;

        // XXX: evil hack until SYJS-28 is fixed
        Object.keys(all_members).map(function(userId) {
            if (all_members[userId].user && !all_members[userId].user.lastPresenceTs) {
                all_members[userId].user.lastPresenceTs = Date.now();
            }
        });

        return all_members;
    },

    roomMembers: function(limit) {
        var all_members = this.memberDict || {};
        var all_user_ids = Object.keys(all_members);

        if (this.memberSort) all_user_ids.sort(this.memberSort);

        var to_display = [];
        var count = 0;
        for (var i = 0; i < all_user_ids.length && (limit === undefined || count < limit); ++i) {
            var user_id = all_user_ids[i];
            var m = all_members[user_id];

            if (m.membership == 'join' || m.membership == 'invite') {
                to_display.push(user_id);
                ++count;
            }
        }
        return to_display;
    }
};

