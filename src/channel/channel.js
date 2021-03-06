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


class channel extends dispatcher
{
	#channelName = undefined;
	#sid = undefined;
	#dbcore = undefined;
	#isOnline = false;

    constructor(channelName, sid ,dBCoreObject)
	{
		super();
		this.#channelName = channelName;
		this.#sid = sid;
		this.#dbcore = dBCoreObject;
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
		
		if (this.#channelName.toLowerCase() == "sys:*") throw (new dBError("E015"));
		if(!eventName) throw(new dBError("E058"));
		if(typeof eventName != 'string') throw(new dBError("E059"));

		let m_status =  utils.updatedBNewtworkSC(this.#dbcore, MessageTypes.PUBLISH_TO_CHANNEL, this.#channelName, null ,  eventData, eventName,null,null,seqnum );

		if(!m_status) throw(new dBError("E014"));

		return;
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

module.exports = channel;