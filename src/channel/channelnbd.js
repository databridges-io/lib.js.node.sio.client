/*
	DataBridges Node.js client Library
	https://www.databridges.io/



	Copyright 2022 Optomate Technologies Private Limited.

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

const MessageTypes = require('../msgtypes/dbmessagetypes');
const utils = require('../utils/util')
const dispatcher =  require('../dispatcher/dispatcher');
const dBError = require('../exception/errormessages');

const connectSupportedEvents = [utils.systemEvents.CONNECT_SUCCESS , 
								utils.systemEvents.CONNECT_FAIL,
								utils.systemEvents.RECONNECT_SUCCESS,
								utils.systemEvents.RECONNECT_FAIL,
								utils.systemEvents.DISCONNECT_SUCCESS,
								utils.systemEvents.DISCONNECT_FAIL,
								utils.systemEvents.ONLINE,
								utils.systemEvents.OFFLINE,
								utils.systemEvents.REMOVE, 
								utils.systemEvents.PARTICIPANT_JOINED,
								utils.systemEvents.PARTICIPANT_LEFT];


class channelnbd
{
	#channelName = undefined;
	#dbcore = undefined;
	#sid = undefined;
	#dispatch = undefined;
	#isOnline=false;

    constructor(channelName, sid,  dBCoreObject)
	{
		this.#channelName = channelName;
		this.#dbcore = dBCoreObject;
		this.#sid = sid;
		this.#dispatch =  new dispatcher();
		this.#isOnline = false;
	}
	
	getChannelName(){
		return this.#channelName;
	}

	isOnline()
	{
		return this.#isOnline;
	}

	_set_isOnline(value)
	{
		this.#isOnline = value;
	}

	
	publish(eventName  , eventData, seqnum=undefined)
	{
		if(!this.#isOnline) throw(new dBError("E014"));

		if(!eventName) throw(new dBError("E058"));
		if(typeof eventName != 'string') throw(new dBError("E059"));

		
		if (this.#channelName.toLowerCase() == "sys:*") throw (new dBError("E015"));
	
		let m_status =  utils.updatedBNewtworkSC(this.#dbcore, MessageTypes.PUBLISH_TO_CHANNEL, this.#channelName, null ,  eventData, eventName , null, null, seqnum);

		if(!m_status) throw(new dBError("E014"));
		return;
	}


	bind(eventName, callback)
	{
		if(connectSupportedEvents.includes(eventName)) {
			try{
				this.#dispatch.bind(eventName, callback);
			}catch(err){
				throw err;
			}
		}else{
			throw (new dBError("E103"))
		}
	}

	unbind(eventName, callback)
	{
		if(connectSupportedEvents.includes(eventName)) {
			if(this.#dispatch.isExists(eventName)) this.#dispatch.unbind(eventName, callback);
		}
	}

	emit_channel(eventName , EventInfo ,  channelName ,  metadata)
	{
		this.#dispatch.emit_channel(eventName , EventInfo ,  channelName ,  metadata);
	}



	

	call(functionName ,  payload ,  ttl , callback)
	{
		return new Promise( async (resolve , reject) =>{
			if( !['channelMemberList', 'channelMemberInfo', 'timeout' ,  'err'].includes(functionName)){
				reject(new dBError("E038"));
			}else{
			if(this.#channelName.toLowerCase().startsWith("prs:") || 
			this.#channelName.toLowerCase().startsWith("sys:") ) {
				let caller = this.#dbcore.rpc.ChannelCall(this.#channelName);

				caller.call(functionName ,  payload ,  ttl ,  (response)=>{
                    callback(response)
                })
                .then((response) => {

                    resolve(response)
                })
                .catch((error)=>{

                    reject(error)
                });
			}else{
				reject(new dBError("E039"));
			}
		}
		});
	}

}


module.exports = channelnbd;