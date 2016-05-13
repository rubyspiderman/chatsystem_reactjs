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

'use strict';

var MatrixClientPeg = require('../../MatrixClientPeg');

/*
 * View class should provide:
 * - getUrlList() returning an array of URLs to try for the room avatar
     in order of preference from the most preferred at index 0. null entries
     in the array will be skipped over.
 */
module.exports = {
    getDefaultProps: function() {
        return {
            width: 36,
            height: 36,
            resizeMethod: 'crop'
        }
    },

    getInitialState: function() {
        this._update();
        return {
            imageUrl: this._nextUrl()
        };
    },

    componentWillReceiveProps: function(nextProps) {
        this._update();
        this.setState({
            imageUrl: this._nextUrl()
        });
    },

    _update: function() {
        this.urlList = this.getUrlList();
        this.urlListIndex = -1;
    },

    _nextUrl: function() {
        do {
            ++this.urlListIndex;
        } while (
            this.urlList[this.urlListIndex] === null &&
            this.urlListIndex < this.urlList.length
        );
        if (this.urlListIndex < this.urlList.length) {
            return this.urlList[this.urlListIndex];
        } else {
            return null;
        }
    },

    // provided to the view class for convenience
    roomAvatarUrl: function() {
        var url = this.props.room.getAvatarUrl(
            MatrixClientPeg.get().getHomeserverUrl(),
            this.props.width, this.props.height, this.props.resizeMethod,
            false
        );
        return url;
    },

    // provided to the view class for convenience
    getOneToOneAvatar: function() {
        var userIds = Object.keys(this.props.room.currentState.members);

        if (userIds.length == 2) {
            var theOtherGuy = null;
            if (this.props.room.currentState.members[userIds[0]].userId == MatrixClientPeg.get().credentials.userId) {
                theOtherGuy = this.props.room.currentState.members[userIds[1]];
            } else {
                theOtherGuy = this.props.room.currentState.members[userIds[0]];
            }
            return theOtherGuy.getAvatarUrl(
                MatrixClientPeg.get().getHomeserverUrl(),
                this.props.width, this.props.height, this.props.resizeMethod,
                false
            );
        } else if (userIds.length == 1) {
            return this.props.room.currentState.members[userIds[0]].getAvatarUrl(
                MatrixClientPeg.get().getHomeserverUrl(),
                this.props.width, this.props.height, this.props.resizeMethod,
                    false
            );
        } else {
           return null;
        }
    },


    onError: function(ev) {
        this.setState({
            imageUrl: this._nextUrl()
        });
    }
};
