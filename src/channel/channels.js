
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
const channel = require('./channel');
const utils = require('../utils/util');
const channelnbd = require('./channelnbd');
const channelStatus = require('./channelstatus');
const dispatcher =  require('../dispatcher/dispatcher');
const CResponse =  require('./accessresponse');
const dBError = require('../exception/errormessages');

class Channels
{
	#channel_type = undefined;
	#channelsid_registry = undefined;
	#channelname_sid = undefined;
	#dbcore = undefined;
	#dispatch = undefined;
	#metadata =  {
		"channelname": undefined , 
		"eventname": undefined,
		"sourcesysid": undefined, 
		"sqnum": undefined,
		"sessionid": undefined, 
		"intime": undefined,
	};
	


    constructor(dBCoreObject)
	{		

		this.#channel_type = ["pvt" ,   "prs", "sys"];
		this.#channelsid_registry=new Map(); //key sid and value is object 

		this.#channelname_sid = new Map();
		this.#dbcore = dBCoreObject;
		this.#dispatch =  new dispatcher();
	}

	bind(eventName, callback)
	{
		this.#dispatch.bind(eventName, callback);
	}

	unbind(eventName, callback)
	{
		this.#dispatch.unbind(eventName, callback);
	}

	bind_all(callback)
	{
		this.#dispatch.bind_all(callback);
	}

	unbind_all(callback)
	{
		this.#dispatch.unbind_all(callback);
	}


	_handledispatcher(eventName ,  eventInfo=undefined,  metadata=undefined )
	{
		this.#dispatch.emit_channel(eventName, eventInfo,metadata);
	}


	_handledispatcherEvents(eventName ,  eventInfo=undefined, channelName=undefined, metadata=undefined)
	{
		this.#dispatch.emit_channel(eventName, eventInfo,metadata);
		let sid =  this.#channelname_sid.get(channelName);
		let m_object =  this.#channelsid_registry.get(sid);
		if(!m_object) return;
		m_object.ino.emit_channel(eventName, eventInfo,metadata);
	}



	isPrivateChannel(channelName)
	{
		let flag = false;
		if(channelName.includes(":")){
			var sdata = channelName.toLowerCase().split(":");
			if(this.#channel_type.includes(sdata[0])) {
				flag = true;
			}else{
				flag=false;
			}
		}
		return flag;

	}


	_ReSubscribeAll()
	{
		const _communicateR = async (mtype , channelName, sid , access_token)=>
		{
			let cStatus =  false;
			if(mtype ==  0){
				cStatus = utils.updatedBNewtworkSC(this.#dbcore, MessageTypes.SUBSCRIBE_TO_CHANNEL, channelName, sid ,  access_token );
			}else{
				cStatus = utils.updatedBNewtworkSC(this.#dbcore, MessageTypes.CONNECT_TO_CHANNEL, channelName, sid ,  access_token );
			}
			if(!cStatus) {

				if(!cStatus) {
					if(mtype ==  0){
						throw(new dBError("E024"));
					} else{
						throw(new dBError("E090"));
					}
				}
			}
		}

		const _ReSubscribe = async (sid)=>{
			let m_object = this.#channelsid_registry.get(sid)
			let access_token =  undefined;

			const mprivate =  this.isPrivateChannel(m_object.name);

			switch(m_object.status)
			{
				case channelStatus.SUBSCRIPTION_ACCEPTED:
				case channelStatus.SUBSCRIPTION_INITIATED:
					try {
						if (!mprivate) {
							
							_communicateR(0, m_object.name , sid, access_token);
						}else{
							const response = new CResponse(0, m_object.name, sid, this);
							let m_actiontype = undefined;

								if (m_object.name.toLowerCase().startsWith("sys:")) {
									m_actiontype = utils.accessTokenActions.SYSTEM_CHANNELSUBSCRIBE;
								} else {
									m_actiontype = utils.accessTokenActions.CHANNELSUBSCRIBE;
								}
							
							this.#dbcore._accesstoken_dispatcher(m_object.name , m_actiontype ,  response );
						}
						
					} catch (error) {
						this._handleSubscribeEvents([utils.systemEvents.OFFLINE] , error ,  m_object);
						return;
					}
					break;
				case channelStatus.CONNECTION_INITIATED:
				case channelStatus.CONNECTION_ACCEPTED:
					try {
						if(!mprivate){
							_communicateR(1, m_object.name , sid, access_token);
						}else{
							const response =  new CResponse(1 , m_object.name ,  sid , this)
							this.#dbcore._accesstoken_dispatcher(m_object.name , utils.accessTokenActions.CHANNELCONNECT ,  response );				
						}


					} catch (error) {
						this._handleSubscribeEvents([utils.systemEvents.OFFLINE] , error ,  m_object);
						return;
					}
					break;
				
				case channelStatus.UNSUBSCRIBE_INITIATED:
					m_object.ino._set_isOnline(false);
					this._handleSubscribeEvents([utils.systemEvents.UNSUBSCRIBE_SUCCESS,utils.systemEvents.REMOVE] , "" ,  m_object);
					this.#channelname_sid.delete(m_object.name);
					this.#channelsid_registry.delete(sid);

					break;
						
				case channelStatus.DISCONNECT_INITIATED:
					m_object.ino._set_isOnline(false);
					this._handleSubscribeEvents([ utils.systemEvents.DISCONNECT_SUCCESS, utils.systemEvents.REMOVE] , "" ,  m_object);
					this.#channelname_sid.delete(m_object.name);
					this.#channelsid_registry.delete(sid);
					break;


			}

		}


		this.#channelname_sid.forEach((value,key) => {
			_ReSubscribe(value);
		});
	}




	isEmptyOrSpaces(str){
		return str === null || (/^ *$/).test(str);
	}



	_validateChanelName(channelName, error_type=0)
	{
		if(!this.#dbcore.connectionstate.isconnected) {
			switch (error_type) {
				case 0:
					throw (new dBError("E024"));
					break;
				case 1:
					throw (new dBError("E090"));
					break;
				default:
					break;
			}
			
		}
		if(typeof channelName != 'string') {
			switch (error_type) {
				case 0:
					throw (new dBError("E026"));
					break;
				case 1:
					throw (new dBError("E095"));
					break;
				
				default:
					break;
			}
		}
		if(this.isEmptyOrSpaces(channelName)) {
			switch (error_type) {
				case 0:
					throw (new dBError("E025"));
					break;
				case 1:
					throw (new dBError("E095"));
					break;
				
				default:
					break;
			}
		}
		if(channelName.length > 64) {
			switch (error_type) {
				case 0:
					throw (new dBError("E027"));
					break;
				case 1:
					throw (new dBError("E095"));
					break;
				
				default:
					break;
			}

		}
		//var letters = '/^[0-9a-zA-Z_-:.]+$/';
		if(!(/^[a-zA-Z0-9\.:_-]*$/.test(channelName))) {
			switch (error_type) {
				case 0:
					throw (new dBError("E028"));
					break;
				case 1:
					throw (new dBError("E095"));
					break;
				default:
					break;
			}
		}
		
		if(channelName.includes(":")){
			var sdata = channelName.toLowerCase().split(":");
			if(!this.#channel_type.includes(sdata[0])) {
				switch (error_type) {
					case 0:
						throw (new dBError("E028"));
						break;
					case 1:
						throw (new dBError("E095"));
						break;
					default:
						break;
				}
			}
		}



	}


	_communicate(mtype , channelName, mprivate ,  action)
	{
		let cStatus =  false;
		let m_channel = undefined;
		let m_value = undefined;
		let access_token =  null;
		let sid =  utils.GenerateUniqueId();

		if(!mprivate){
			if(mtype ==  0){
				cStatus = utils.updatedBNewtworkSC(this.#dbcore, MessageTypes.SUBSCRIBE_TO_CHANNEL, channelName, sid ,  access_token );
			}else{
				cStatus = utils.updatedBNewtworkSC(this.#dbcore, MessageTypes.CONNECT_TO_CHANNEL, channelName, sid ,  access_token );
			}
			if(!cStatus){

				if(mtype ==  0){
					throw(new dBError("E024"));
				} else{
					throw(new dBError("E090"));
				}
			} 
		} else {
			const response =  new CResponse(mtype , channelName ,  sid , this)
			this.#dbcore._accesstoken_dispatcher(channelName , action ,  response );
		}

		if (mtype == 0) {
			m_channel = new channel(channelName, sid, this.#dbcore);
			m_value = { "name": channelName, "type": "s", "status": channelStatus.SUBSCRIPTION_INITIATED, "ino": m_channel };
		} else {
			m_channel = new channelnbd(channelName, sid, this.#dbcore);
			m_value = { "name": channelName, "type": "c", "status": channelStatus.CONNECTION_INITIATED, "ino": m_channel };
		}

		this.#channelsid_registry.set(sid, m_value);
		this.#channelname_sid.set(channelName, sid);

		return m_channel;
	}



	_verify_acccess_response(access_object)
	{
		let mresult = false;
		let merror =  "";

		if(!("statuscode" in access_object)) {
			merror = "the return object structure is blank, does not contain statuscode key";
			return {'result': false,  'msg': merror , 'token': ''};
		}

		if((typeof access_object.statuscode != 'number')) {
			merror = "the return object structure is blank, statuscode vaule must be numeric";
			return {'result': false,  'msg': merror , 'token': ''};
		}

		if(access_object.statuscode != 0 ){
			if(!("error_message" in access_object)) {
					merror = "access_token function return statuscode: " + access_object.statuscode + " error_message tag missing"
			}else{
				merror = access_object.error_message;
			}
			return {'result': false,  'msg': merror , 'token': ''};
		}

		if(!("accesskey" in access_object)) {
			merror =  "access_token function return statuscode: " + access_object.statuscode + " accesskey tag missing";
			return {'result': false,  'msg': merror , 'token': ''};
		}
		if(!access_object.accesskey) {
			merror = "access_token function return statuscode: " + access_object.statuscode + " accesskey is blank";
			return {'result': false,  'msg': merror , 'token': ''};
		}

		
		return {'result': true,  'msg': '' , 'token': access_object.accesskey};
	}

	_failure_dispatcher(mtype , sid , reason, newreason=0)
	{

		const m_object = this.#channelsid_registry.get(sid);
		m_object.ino._set_isOnline(false);
		let dberror = undefined
		if (mtype == 0) {
			if (newreason == 0) {
				dberror = new dBError("E091");
			} else {
				dberror = new dBError("E024");
			}

			dberror.updatecode("" ,  reason)
			this._handleSubscribeEvents([utils.systemEvents.SUBSCRIBE_FAIL] , dberror ,  m_object);
		
		} else {
			if (newreason == 0) {
				dberror = new dBError("E092");
			} else {
				dberror = new dBError("E090");
			}
			dberror.updatecode("" ,  reason)
			this._handleSubscribeEvents([utils.systemEvents.CONNECT_FAIL] , dberror,  m_object);

		}
		this.#channelname_sid.delete(m_object.name);
		this.#channelsid_registry.delete(sid);
	}

	_send_to_dbr(mtype , channelName , sid , access_data)
	{
		let cStatus = undefined;

		let v_result = this._verify_acccess_response(access_data)
		if(!v_result.result){
			this._failure_dispatcher(mtype , sid ,  v_result.msg);
			return ;
		}
		let access_token = v_result.token;

		if(mtype ==  0){
			cStatus = utils.updatedBNewtworkSC(this.#dbcore, MessageTypes.SUBSCRIBE_TO_CHANNEL, channelName, sid ,  access_token );
		}else{
			cStatus = utils.updatedBNewtworkSC(this.#dbcore, MessageTypes.CONNECT_TO_CHANNEL, channelName, sid ,  access_token );
		}

		if(!cStatus){
				this._failure_dispatcher(mtype , sid ,  "library is not connected with the dbridges network", 1);
		}

	}



	subscribe(channelName)
	{
		let access_token = null;
		
		if (channelName.toLowerCase() != "sys:*") {
			try {
				this._validateChanelName(channelName)
			} catch (error) {
				throw (error);
			}
		}

		if(this.#channelname_sid.has(channelName)) throw(new dBError("E093"));

		const mprivate =  this.isPrivateChannel(channelName);

		let m_channel = undefined;
		let m_actiontype = undefined;

		if (channelName.toLowerCase().startsWith("sys:")) {
			m_actiontype = utils.accessTokenActions.SYSTEM_CHANNELSUBSCRIBE;
		} else {
			m_actiontype = utils.accessTokenActions.CHANNELSUBSCRIBE;
		}


		try {

			m_channel = this._communicate(0 , channelName, mprivate, m_actiontype);
		} catch (error) {
			throw(error);
		}
		return m_channel;
	}


	connect(channelName)
	{
		let access_token = null;
		
		if (channelName.toLowerCase() != "sys:*") {
			try {
				this._validateChanelName(channelName, 1)
			} catch (error) {
				throw (error);
			}
		}


		if (channelName.toLowerCase().startsWith("sys:")) throw (new dBError("E095")); 

		if(this.#channelname_sid.has(channelName)) throw(new dBError("E094"));

		const mprivate =  this.isPrivateChannel(channelName);

		let m_channel = undefined;
		let m_actiontype = undefined;


		try {
			m_channel = this._communicate(1 , channelName, mprivate , utils.accessTokenActions.CHANNELCONNECT);
		} catch (error) {
			throw(error);
		}
		return m_channel;
	}



	unsubscribe(channelName)
	{
		if(!this.#channelname_sid.has(channelName)) throw(new dBError("E030"))

		let sid = this.#channelname_sid.get(channelName);
		let m_object = this.#channelsid_registry.get(sid);
		let m_status = false;
		if(m_object.type != "s") throw(new dBError("E096"));

		if(m_object.status == channelStatus.UNSUBSCRIBE_INITIATED) throw(new dBError("E097"));

		if(m_object.status == channelStatus.SUBSCRIPTION_ACCEPTED || 
			m_object.status == channelStatus.SUBSCRIPTION_INITIATED ||
			m_object.status == channelStatus.SUBSCRIPTION_PENDING || 
			m_object.status == channelStatus.SUBSCRIPTION_ERROR || 
			m_object.status == channelStatus.UNSUBSCRIBE_ERROR ){
				m_status = utils.updatedBNewtworkSC(this.#dbcore, MessageTypes.UNSUBSCRIBE_DISCONNECT_FROM_CHANNEL, channelName, sid ,  undefined );
		}

		if(!m_status) throw(new dBError("E098")); 

		this.#channelsid_registry.get(sid).status =  channelStatus.UNSUBSCRIBE_INITIATED;
	}


	disconnect(channelName)
	{
		if(!this.#channelname_sid.has(channelName)) throw(new dBError("E099"))

		let sid = this.#channelname_sid.get(channelName);
		let m_object = this.#channelsid_registry.get(sid);
		let m_status = false;
		
		if(m_object.type != "c") throw(new dBError("E100"));

		if(m_object.status == channelStatus.DISCONNECT_INITIATED) throw(new dBError("E101"));

		if(m_object.status == channelStatus.CONNECTION_ACCEPTED || 
			m_object.status == channelStatus.CONNECTION_INITIATED ||
			m_object.status == channelStatus.CONNECTION_PENDING || 
			m_object.status == channelStatus.CONNECTION_ERROR || 
			m_object.status == channelStatus.DISCONNECT_ERROR ){
				m_status = utils.updatedBNewtworkSC(this.#dbcore, MessageTypes.UNSUBSCRIBE_DISCONNECT_FROM_CHANNEL, channelName, sid ,  undefined );
		}

		if(!m_status) throw(new dBError("E102")); 

		this.#channelsid_registry.get(sid).status =  channelStatus.DISCONNECT_INITIATED;
	}



	_handleSubscribeEvents(eventName , eventData ,  m_object)
	{
		const dispatchEvents = async (i) => {

			let metadata =  Object.assign({}, this.#metadata);
			 metadata.channelname =  m_object.ino.getChannelName();
			metadata.eventname = eventName[i];

			this.#dispatch.emit_channel(eventName[i], eventData, metadata);
			m_object.ino.emit_channel(eventName[i], eventData, metadata);

	
			i = i + 1;
            if (i < eventName.length) {
                dispatchEvents(i);
            } 
		}
		if (eventName.length > 0) {
            dispatchEvents(0);
        } 
	}


	_updateSubscribeStatus(sid , status , reason)
	{
		if(!this.#channelsid_registry.has(sid)) return;
		let m_object = this.#channelsid_registry.get(sid);

		switch(m_object.type)
		{
			case "s":
				switch(status){
					case channelStatus.SUBSCRIPTION_ACCEPTED:
							this.#channelsid_registry.get(sid).status = status;
							m_object.ino._set_isOnline(true);
							this._handleSubscribeEvents([utils.systemEvents.SUBSCRIBE_SUCCESS, utils.systemEvents.ONLINE] , "" ,  m_object);
						break;
					default:
							this.#channelsid_registry.get(sid).status = status;
							m_object.ino._set_isOnline(false);
							this._handleSubscribeEvents([utils.systemEvents.SUBSCRIBE_FAIL] , reason ,  m_object);
							this.#channelname_sid.delete(m_object.name);
							this.#channelsid_registry.delete(sid);

						break;

				}
				break;
			case "c":
				switch(status){
					case channelStatus.CONNECTION_ACCEPTED:
							this.#channelsid_registry.get(sid).status = status;
							m_object.ino._set_isOnline(true);
							this._handleSubscribeEvents([utils.systemEvents.CONNECT_SUCCESS,  utils.systemEvents.ONLINE] , "" ,  m_object);
						break;
					default:
							this.#channelsid_registry.get(sid).status = status;
							m_object.ino._set_isOnline(false);
							this._handleSubscribeEvents([utils.systemEvents.CONNECT_FAIL] , reason ,  m_object);
							this.#channelname_sid.delete(m_object.name);
							this.#channelsid_registry.delete(sid);

						break;

				}
				break;
			default:
				break;
		}
		
	}




	_updateSubscribeStatusRepeat(sid , status , reason)
	{
		if(!this.#channelsid_registry.has(sid)) return;
		let m_object = this.#channelsid_registry.get(sid);

		switch(m_object.type)
		{
			case "s":
				switch(status){
					case channelStatus.SUBSCRIPTION_ACCEPTED:
							this.#channelsid_registry.get(sid).status = status;
						m_object.ino._set_isOnline(true);
						this._handleSubscribeEvents([utils.systemEvents.RESUBSCRIBE_SUCCESS, utils.systemEvents.ONLINE], "", m_object);
						break;
					default:
							this.#channelsid_registry.get(sid).status = status;
						m_object.ino._set_isOnline(false);
						this._handleSubscribeEvents([utils.systemEvents.OFFLINE], reason, m_object);
						break;

				}
				break;
			case "c":
				switch(status){
					case channelStatus.CONNECTION_ACCEPTED:
							this.#channelsid_registry.get(sid).status = status;
						m_object.ino._set_isOnline(true);
						this._handleSubscribeEvents([utils.systemEvents.RECONNECT_SUCCESS, utils.systemEvents.ONLINE], "", m_object);
						break;
					default:
							this.#channelsid_registry.get(sid).status = status;
							m_object.ino._set_isOnline(false);
							this._handleSubscribeEvents([utils.systemEvents.OFFLINE] , reason ,  m_object);
						break;

				}
				break;
			default:
				break;
		}
		
	}
	
	

	_updateChannelsStatusAddChange(life_cycle, sid ,  status ,  reason)
	{
		if(life_cycle == 0)  
		{
			this._updateSubscribeStatus(sid , status, reason);
		}else{ 
			this._updateSubscribeStatusRepeat(sid , status, reason);
		}
	}


	_updateChannelsStatusRemove(sid, status, reason)
	{
		if(!this.#channelsid_registry.has(sid)) return;
		let m_object = this.#channelsid_registry.get(sid);

		switch(m_object.type)
		{
			case "s":
				switch(status){
					case channelStatus.UNSUBSCRIBE_ACCEPTED:
							this.#channelsid_registry.get(sid).status = status;
							m_object.ino._set_isOnline(false);
							this._handleSubscribeEvents([utils.systemEvents.UNSUBSCRIBE_SUCCESS,utils.systemEvents.REMOVE] , "" ,  m_object);
							this.#channelname_sid.delete(m_object.name);
							this.#channelsid_registry.delete(sid);
						break;
					default:
							this.#channelsid_registry.get(sid).status = channelStatus.SUBSCRIPTION_ACCEPTED;
							m_object.ino._set_isOnline(true);
							this._handleSubscribeEvents([utils.systemEvents.UNSUBSCRIBE_FAIL , utils.systemEvents.ONLINE] , reason ,  m_object);
						break;

				}
				break;
			case "c":
				switch(status){
					case channelStatus.DISCONNECT_ACCEPTED:
							this.#channelsid_registry.get(sid).status = status;
							m_object.ino._set_isOnline(false);
							this._handleSubscribeEvents([ utils.systemEvents.DISCONNECT_SUCCESS, utils.systemEvents.REMOVE] , "" ,  m_object);
							this.#channelname_sid.delete(m_object.name);
							this.#channelsid_registry.delete(sid);
						break;
					default:
							this.#channelsid_registry.get(sid).status = channelStatus.CONNECTION_ACCEPTED;
							m_object.ino._set_isOnline(true);
							this._handleSubscribeEvents([utils.systemEvents.DISCONNECT_FAIL,   utils.systemEvents.ONLINE] , reason ,  m_object);
						break;

				}
				break;
			default:
				break;
		}
	}



	_isonline(sid)
	{
		if(!this.#channelsid_registry.has(sid)) return false;
		let m_object =  this.#channelsid_registry.get(sid);
		if(m_object.status == channelStatus.CONNECTION_ACCEPTED ||
			m_object.status == channelStatus.SUBSCRIPTION_ACCEPTED ) return true;

		return false;
	}

	isOnline(channelName)
	{
		if (!this.#channelname_sid.has(channelName)) return false;
		if(!this.#dbcore._isSocketConnected()) return false;
		
		let sid =  this.#channelname_sid.get(channelName);
		return this._isonline(sid);
	}

	list()
	{
		let m_data = [];

		this.#channelsid_registry.forEach((value,key) => {
			let i_data = {"name":  value.name , "type": (value.type == "s")? "subscribed": "connect" ,  "isonline": this._isonline(key) };
			m_data.push(i_data);
		});

		return m_data;
	}

	_send_OfflineEvents(){

		this.#channelsid_registry.forEach((value,key) => {

			let metadata = Object.assign({}, this.#metadata);
			metadata.channelname = value.ino.getChannelName();
			metadata.eventname = utils.systemEvents.OFFLINE;
			value.ino._set_isOnline(false);

			this._handledispatcherEvents(utils.systemEvents.OFFLINE, value.name, value.name, metadata);
		});

	}
	
	_get_subscribeStatus(sid)
	{
		return this.#channelsid_registry.get(sid).status;
	}


	_get_channelType(sid)
	{
		return this.#channelsid_registry.has(sid) ? this.#channelsid_registry.get(sid).type : "";
	}


	_get_channelName(sid)
	{
		return (this.#channelsid_registry.has(sid))? this.#channelsid_registry.get(sid).name : undefined;
	}


	getConnectStatus(sid)
	{
		return this.#channelsid_registry.get(sid).status;
	}


	getChannel(sid)
	{
		if(!this.#channelsid_registry.has(sid)) return undefined;
		return this.#channelsid_registry.get(sid).ino;
	}

	getChannelName(sid)
	{
		if(!this.#channelsid_registry.has(sid)) return undefined;
		return this.#channelsid_registry.get(sid).name;
	}

	isSubscribedChannel(sid)
	{
		if(!this.#channelsid_registry.has(sid)) return false;
		if(this.#channelsid_registry.get(sid).type == "s"){
			return this.#channelsid_registry.get(sid).ino.isSubscribed;
		}else{
			return false;
		}

	}

	cleanUp_All()
	{
		
		const clean_channel=(sid)=>{
			return new Promise(resolve => {
				let mobject = this.#channelsid_registry.get(sid);
				if(mobject.type == "s"){
					mobject.ino.unbind();
					mobject.ino.unbind_all();
				}else{
					mobject.ino.unbind();
				}
				resolve();
			});
			
		}

		this.#channelname_sid.forEach((value,key) => {
			let metadata =  Object.assign({}, this.#metadata);
			 metadata.channelname =  key;
			 metadata.eventname = "dbridges:channel.removed";
			
			
			this._handledispatcherEvents(utils.systemEvents.REMOVE , undefined , key ,metadata );
			clean_channel(value)
				.then(()=>{
					this.#channelname_sid.delete(key);
					this.#channelsid_registry.delete(value);
				});
		});

		//this.#dispatch.unbind();
		//this.#dispatch.unbind_all();

	}
}

module.exports = Channels;