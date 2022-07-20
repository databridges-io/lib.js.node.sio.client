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

const dispatcher =  require('../dispatcher/dispatcher');
const CrpcResponse = require('./rpcresponse');
const dBError = require('../exception/errormessages');
const utils = require('../utils/util');

class Crpcclient
{
    #dispatch = undefined;
	#dbcore = undefined;
	enable =false;
	functions = undefined;
	#functionNames = undefined
	
    constructor(dBCoreObject)
    {
        this.#dispatch = new dispatcher();
	    this.#dbcore = dBCoreObject;
		this.enable =  false;
		this.functions = undefined;
		this.#functionNames = ['cf.callee.queue.exceeded', 'cf.response.tracker'];
    }


	_verify_function()
	{
		let mflag = false;
		if(this.enable){
			if(!this.functions) throw(new dBError("E009"));
			if(typeof this.functions != 'function')	throw(new dBError("E010"));			
			mflag=true;
		}else{
			mflag = true;
		}
		return mflag
	}



	regfn(functionName, callback) {
		if (!(functionName)) throw (new dBError("E110"));
		if (!(callback)) throw (new dBError("E111"));
		if (!(typeof functionName === "string")) throw (new dBError("E110"));
		if (!(typeof callback === "function")) throw (new dBError("E111"));

		if (this.#functionNames.includes(functionName)) throw (new dBError("E110"));
		this.#dispatch.bind(functionName, callback);
	}


	unregfn(functionName, callback) {
		if (this.#functionNames.includes(functionName)) return;
		this.#dispatch.unbind(functionName, callback);
	}


    bind(eventName , callback)  
	{

		if(!(eventName)) throw (new dBError("E066")); 
		
		if(!(callback)) throw (new dBError("E067"));
		
		if(!(typeof eventName === "string" )) throw(new dBError("E066")); 
		if (!(typeof callback === "function")) throw (new dBError("E067"));

		if (!this.#functionNames.includes(eventName)) throw (new dBError("E066"));

		this.#dispatch.bind(eventName , callback);
	}


	unbind(eventName, callback) 
	{
		if (!this.#functionNames.includes(eventName)) return;
	    this.#dispatch.unbind(eventName , callback); 
	}


	_handle_dispatcher(functionName ,  returnSubect ,  sid , payload)
	{
		let response = new CrpcResponse(functionName,returnSubect, sid ,  this.#dbcore );
		this.#dispatch.emit_clientfunction(functionName ,  payload ,  response);
	}
	
	_handle_tracker_dispatcher(responseid ,  errorcode)
	{
		
		this.#dispatch.emit_clientfunction('cf.response.tracker' ,  responseid , errorcode);
	}

	_handle_exceed_dispatcher()
	{
		let err = new dBError("E070")
		err.updatecode("CALLEE_QUEUE_EXCEEDED");
		this.#dispatch.emit_clientfunction('cf.callee.queue.exceeded', err, null);

		// reset cf queue 
	}

	resetqueue() {

		let m_status  = utils.updatedBNewtworkCF(this.#dbcore, MessageTypes.CF_CALLEE_QUEUE_EXCEEDED, null, null, null, null, null, null, null);
		if (!m_status) throw (new dBError("E068"));
	}
}


module.exports = Crpcclient;