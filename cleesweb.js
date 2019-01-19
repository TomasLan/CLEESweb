// -----------------------------------------------------------
//                       CLEES web
//                       ---------
//  Controll your Layout using Ethernet and Easy Scripts
//
//  This code works as a web remote to controll you CLEES
//  controlled layout. Communicating using mqtt msg only  
//
//  Author: Tomas (Tompa) Lannestedt
//  License: MIT
// -----------------------------------------------------------


var Ver = "0.1.0";  // 2019-01-19  First draft but working release
					// All files shows Station Holmfors as an example



// ----------- Settings --------------
var CLEESfullname = "Holmfors";
var CLEESshortname = "hfs";
var CleesSVGcanvasXsize  = 9;
var CleesSVGcanvasYsize  = 4;
var CleesMatrixBlockSize = 50;
var MQTThostname = "172.16.1.16";
var MQTTport = "1884";
// -----------------------------------

var Dbug = false;  // set to false before release


// ------------ Declarations ----------
function aCleesobject () {
	this.id = "";  //
    this.type = "";
	this.x = 0;
	this.y = 0;
	this.direction = "R";     // "R" for Right, "L" for Left
	this.rotate = 0;          // 0 for normal, 1 for turned around 180dgr
	this.orientation = "V";   // "H" for horizontal, "V" for vertical  
    this.position = "";       // "" for turnaout not yet received a mqtt report, "C" for closed, "T" for thrown 
	this.occupied = 0;        // 0 for false, 1 for true = train present on the track
	this.havestates = 0;      // 0 for stateless sections that always be black, 1 for tracksections that has mqtt states,
	this.inroute = 0;         // 0 for sections not i a route, 1+ for the route number/id
	this.protectiontrack = 0; // 1 for section that belongs to a route an are safty/protection track after route end.
}
var Cleeswebobjects = [];
var MatrixWidth = CleesMatrixBlockSize;
var MatrixHeight = MatrixWidth;
var MQTTclient;
var MQTTconnectID = "";
var MQTTtopic = "clees/"+CLEESshortname+"/";
// -----------------------------------



// -------------------------------------------------------------------------------------------
//                                                Init
// ------------------------------------------------------------------------------------------- 

function initCLEES(){
	document.getElementById("cleeshead").innerHTML = CLEESfullname;
	initCleeswebobjects();
    updateSVG();
	initMQTT();
	printInfo('CLEES webclient started - Looking for mqtt broker');
}



// -------------------------------------------------------------------------------------------
//                                                Support
// ------------------------------------------------------------------------------------------- 

function printInfo(aTxt){
	document.getElementById("cleesinfo").innerHTML = aTxt;	
}

function sleep(ms){
    var waitUntil = new Date().getTime() + ms;
    while(new Date().getTime() < waitUntil) true;
}



// -------------------------------------------------------------------------------------------
//                                                  MTQQ
// ------------------------------------------------------------------------------------------- 

function initMQTT(){
	// Create a client instance
	MQTTclient = new Paho.MQTT.Client(MQTThostname, Number(MQTTport), MQTTconnectID);
	// set callback handlers
    MQTTclient.onConnectionLost = onConnectionLost;
    MQTTclient.onMessageArrived = onMessageArrived;
	MQTTclient.onConnected      = onConnectSuccessfully;
	MQTTconnect();
}


// called from init and when reconnecting
function MQTTconnect(){
	var options = {
        timeout: 3,
		onFailure: onConnectFailure,
		reconnect: true
      };
	// connect the client
    MQTTclient.connect(options);
}


// called when the client connects
function onConnectSuccessfully() {
	printInfo("Connected successfully to "+MQTThostname+":"+MQTTport);
	// Once a connection has been made, make a subscription and send a message.
	if (Dbug) { console.log("onConnect"); }
	MQTTclient.subscribe(MQTTtopic+"#");
	message = new Paho.MQTT.Message("CLEES web client says hello!");
	message.destinationName = MQTTtopic;
	MQTTclient.send(message);
}


function onConnectFailure(){
	if (Dbug) { console.log("No response from Host:"+MQTThostname+":"+MQTTport+" Please retry later."); }
   	printInfo("No response from Host:"+MQTThostname+":"+MQTTport+" Please retry later.");
}


// called when the client loses its connection
function onConnectionLost(responseObject) {
	if (responseObject.errorCode !== 0) {
		if (Dbug) { console.log("Lost Connection:"+responseObject.errorMessage); }
    	printInfo("Lost Connection:"+responseObject.errorMessage+" Auto reconnect activated, just wait.");
	}
}


// called when a message arrives
function onMessageArrived(message) {
	if (Dbug) { console.log("onMessageArrived:"+message.payloadString); }
	if (Dbug) { printInfo("topic:"+message.destinationName+"  msg:"+message.payloadString); }
	// lets evaluat recieved msg
	var topicStrings = message.destinationName.split("/");
	var i;
	var datachanged = false;
	if (Dbug) { printInfo("t1="+topicStrings[0]+" t2="+topicStrings[1]+" t3="+topicStrings[2]+" t4="+topicStrings[3]+" t5="+topicStrings[4]+" msg:"+message.payloadString); }
	// filter out report messages  
	if ((topicStrings[0]+'/'+topicStrings[1]+'/') == MQTTtopic ) {
		if ((topicStrings[2] == "rep") && (topicStrings[3] == "t")) { // report turnout msg
			// Now loop through all clees objects
			for (i = 0; i < Cleeswebobjects.length; i++) {
				// Check for turnouts
				if (Cleeswebobjects[i].type == "turnout"){  
					if (Cleeswebobjects[i].id == topicStrings[4]) {
						// we have a match
						if (message.payloadString == 'thrown'){
							if (Cleeswebobjects[i].position != "T") {
								Cleeswebobjects[i].position = "T"; 
								datachanged = true;
							} 		
						}
						if (message.payloadString == 'closed'){
							if (Cleeswebobjects[i].position != "C") {
								Cleeswebobjects[i].position = "C"; 
								datachanged = true;
							} 		
						}
						if (message.payloadString == 'changing'){
							if (Cleeswebobjects[i].position != "") {
								Cleeswebobjects[i].position = ""; 
								datachanged = true;
							} 		
						}
					}
				}
			}
		}
	}
	if (datachanged){
		updateSVG();
		printInfo("");  // Clears msgs
	}
}


function getCleesobject_cmdtopic (index){
	var returntxt = "";
	if (Cleeswebobjects[index].type == "turnout"){
		returntxt = MQTTtopic+"cmd/t/"+Cleeswebobjects[index].id;
	}
	return returntxt;
}


function onSVGclick(index){
	if (Dbug) { printInfo(index) }
	if (Cleeswebobjects[index].type == "turnout") {
		if (Cleeswebobjects[index].position == "") {
			// send mqtt cmd Close
			message = new Paho.MQTT.Message("close");
			message.destinationName = getCleesobject_cmdtopic(index);
			MQTTclient.send(message);
		}
		if (Cleeswebobjects[index].position == "C") {
			// send mqtt cmd Close
			message = new Paho.MQTT.Message("throw");
			message.destinationName = getCleesobject_cmdtopic(index);
			MQTTclient.send(message);
		}
		if (Cleeswebobjects[index].position == "T") {
			// send mqtt cmd Close
			message = new Paho.MQTT.Message("close");
			message.destinationName = getCleesobject_cmdtopic(index);
			MQTTclient.send(message);
		}

	}
}



// -------------------------------------------------------------------------------------------
//                                                Logic Layer
// ------------------------------------------------------------------------------------------- 

// Clees web Objects
function initCleeswebobjects(){
	// Clear from previous content
	Cleeswebobject = [];
    // Read track section settings from file	
	cleesweb_tracksections.forEach(loadandaddtracksection);
}

// Callback within initCleeswebobjects
function loadandaddtracksection(value, index, array) {
	var tmpobj = new aCleesobject();
	tmpobj.id = value.id;
	tmpobj.type = value.type;
	tmpobj.x = value.xcoord;
	tmpobj.y = value.ycoord;
	if (tmpobj.type == "turnout") {
		tmpobj.orientation = value.orientation;
		tmpobj.direction = value.direction;
		tmpobj.rotate = value.rotate;
		tmpobj.havestates = 1;
	}
	if (tmpobj.type == "straight"){
		tmpobj.orientation = value.orientation;
	}
	if (tmpobj.type == "curve"){
		tmpobj.direction = value.direction;
		tmpobj.rotate = value.rotate;
	}
	Cleeswebobjects.push(tmpobj);
}



// -------------------------------------------------------------------------------------------
//                                            Presentation Layer
// ------------------------------------------------------------------------------------------- 

var SVGtxt = "";

// --- updateSVG
// Will redraw the complete SVG image based on data in the Cleeswebobjects list
function updateSVG(){
	var SVGwidth  = CleesSVGcanvasXsize * CleesMatrixBlockSize;
	var SVGheight = CleesSVGcanvasYsize * CleesMatrixBlockSize;
	SVGtxt = '<svg width="'+SVGwidth+'" height="'+SVGheight+'">';
	Cleeswebobjects.forEach(addcleesobjectSVGtxt);
    SVGtxt += '</svg>';
    document.getElementById("cleessvg").innerHTML = SVGtxt;	
}
// Callback forEach in updateSVG
function addcleesobjectSVGtxt(value,index,array){
	var tmpcolor = "black";
	if (value.havestates == 1) {
		tmpcolor = "lightgrey";
		if (value.position != "") {tmpcolor = "black";}
		if (value.occupied == 1)  {tmpcolor = "red";  }	
	}	
	if (value.type == "straight") {
		SVGtxt += getSVGtrackstraight(value.x,value.y,value.orientation,tmpcolor);
	}
	if (value.type == "curve") {
		SVGtxt += getSVGtrackcurve(value.x,value.y,value.direction,value.rotate,tmpcolor);
	}
	if (value.type == "turnout") {
		var tpos = "";
		if (value.position == "") { // unreported turnouts will be showns as closed
			tpos = "C";
		} else {
			tpos = value.position;
		}
		SVGtxt += getSVGturnout(value.x,value.y,value.orientation,value.direction,value.rotate,tpos,tmpcolor,"onSVGclick('"+index+"')");
	}
}



// -------------------------------------------------------------------------------------------
//                                                Graphics
// ------------------------------------------------------------------------------------------- 

// --- getSVGtrackstraight
// Returns a SVG code sting, representing a straight track section 
function getSVGtrackstraight(posXinMatrix,  // Matrix box number in X-direction
                             posYinMatrix,  // Matrix box number in Y-direction
						     orientation,   // "H" for Horizontal, "V" for vertical
							 color          // "black","red",or "green"
						     )
{
	var x = posXinMatrix * MatrixWidth;
	var y = posYinMatrix * MatrixHeight;
    var txt = '';
    if (orientation == "H") { // Horisontal line
      txt += '<line x1="'+x+'" y1="'+(y+(MatrixHeight/2)-2)+'" x2="'+(x+MatrixWidth)+'" y2="'+(y+(MatrixHeight/2)-2)+'" stroke="'+color+'" stroke-width="1" />';
      txt += '<line x1="'+x+'" y1="'+(y+(MatrixHeight/2)-1)+'" x2="'+(x+MatrixWidth)+'" y2="'+(y+(MatrixHeight/2)-1)+'" stroke="'+color+'" stroke-width="1" />';
      txt += '<line x1="'+x+'" y1="'+(y+(MatrixHeight/2)  )+'" x2="'+(x+MatrixWidth)+'" y2="'+(y+(MatrixHeight/2)  )+'" stroke="'+color+'" stroke-width="1" />';
      txt += '<line x1="'+x+'" y1="'+(y+(MatrixHeight/2)+1)+'" x2="'+(x+MatrixWidth)+'" y2="'+(y+(MatrixHeight/2)+1)+'" stroke="'+color+'" stroke-width="1" />';
      txt += '<line x1="'+x+'" y1="'+(y+(MatrixHeight/2)+2)+'" x2="'+(x+MatrixWidth)+'" y2="'+(y+(MatrixHeight/2)+2)+'" stroke="'+color+'" stroke-width="1" />';
	}
    if (orientation == "V") { // Vertical line
      txt += '<line x1="'+(x+(MatrixWidth/2)-2)+'" y1="'+y+'" x2="'+(x+(MatrixWidth/2)-2)+'" y2="'+(y+MatrixHeight)+'" stroke="'+color+'" stroke-width="1" />';
      txt += '<line x1="'+(x+(MatrixWidth/2)-1)+'" y1="'+y+'" x2="'+(x+(MatrixWidth/2)-1)+'" y2="'+(y+MatrixHeight)+'" stroke="'+color+'" stroke-width="1" />';
      txt += '<line x1="'+(x+(MatrixWidth/2)  )+'" y1="'+y+'" x2="'+(x+(MatrixWidth/2)  )+'" y2="'+(y+MatrixHeight)+'" stroke="'+color+'" stroke-width="1" />';
      txt += '<line x1="'+(x+(MatrixWidth/2)+1)+'" y1="'+y+'" x2="'+(x+(MatrixWidth/2)+1)+'" y2="'+(y+MatrixHeight)+'" stroke="'+color+'" stroke-width="1" />';
      txt += '<line x1="'+(x+(MatrixWidth/2)+2)+'" y1="'+y+'" x2="'+(x+(MatrixWidth/2)+2)+'" y2="'+(y+MatrixHeight)+'" stroke="'+color+'" stroke-width="1" />';
    }
	return txt;
}


// --- getSVGtrackcurve
// Returns a SVG code sting, representing a diagonal track section 
function getSVGtrackcurve(posXinMatrix, // Matrix box number in X-direction
                          posYinMatrix, // Matrix box number in Y-direction
					      direction,    // "R" for Right, "L" for Left
					      rotate,       // 0 for not rotated, 1 for rotated 180dgr
						  color         // "black","red",or "green"
					      )
{
	var x = posXinMatrix * MatrixWidth;
	var y = posYinMatrix * MatrixHeight;
    var txt = '';
    if ((direction == "R") && (rotate == 0)) { // Right  
      txt += '<line x1="'+x+'" y1="'+(y+(MatrixHeight/2)-2)+'" x2="'+(x+(MatrixWidth/2)+2)+'" y2="'+(y+MatrixHeight)+'" stroke="'+color+'" stroke-width="1" />';
      txt += '<line x1="'+x+'" y1="'+(y+(MatrixHeight/2)-1)+'" x2="'+(x+(MatrixWidth/2)+1)+'" y2="'+(y+MatrixHeight)+'" stroke="'+color+'" stroke-width="1" />';
      txt += '<line x1="'+x+'" y1="'+(y+(MatrixHeight/2)  )+'" x2="'+(x+(MatrixWidth/2)  )+'" y2="'+(y+MatrixHeight)+'" stroke="'+color+'" stroke-width="1" />';
      txt += '<line x1="'+x+'" y1="'+(y+(MatrixHeight/2)+1)+'" x2="'+(x+(MatrixWidth/2)-1)+'" y2="'+(y+MatrixHeight)+'" stroke="'+color+'" stroke-width="1" />';
      txt += '<line x1="'+x+'" y1="'+(y+(MatrixHeight/2)+2)+'" x2="'+(x+(MatrixWidth/2)-2)+'" y2="'+(y+MatrixHeight)+'" stroke="'+color+'" stroke-width="1" />';
	}
    if ((direction == "R") && (rotate == 1)) { // Right 180  
      txt += '<line x1="'+(x+(MatrixWidth/2)-2)+'" y1="'+y+'" x2="'+(x+MatrixWidth)+'" y2="'+(y+(MatrixHeight/2)+2)+'" stroke="'+color+'" stroke-width="1" />';
      txt += '<line x1="'+(x+(MatrixWidth/2)-1)+'" y1="'+y+'" x2="'+(x+MatrixWidth)+'" y2="'+(y+(MatrixHeight/2)+1)+'" stroke="'+color+'" stroke-width="1" />';
      txt += '<line x1="'+(x+(MatrixWidth/2)  )+'" y1="'+y+'" x2="'+(x+MatrixWidth)+'" y2="'+(y+(MatrixHeight/2)  )+'" stroke="'+color+'" stroke-width="1" />';
      txt += '<line x1="'+(x+(MatrixWidth/2)+1)+'" y1="'+y+'" x2="'+(x+MatrixWidth)+'" y2="'+(y+(MatrixHeight/2)-1)+'" stroke="'+color+'" stroke-width="1" />';
      txt += '<line x1="'+(x+(MatrixWidth/2)+2)+'" y1="'+y+'" x2="'+(x+MatrixWidth)+'" y2="'+(y+(MatrixHeight/2)-2)+'" stroke="'+color+'" stroke-width="1" />';
	}
    if ((direction == "L") && (rotate == 0)) { // Left 
      txt += '<line x1="'+x+'" y1="'+(y+(MatrixHeight/2)-2)+'" x2="'+(x+(MatrixWidth/2)-2)+'" y2="'+y+'" stroke="'+color+'" stroke-width="1" />';
      txt += '<line x1="'+x+'" y1="'+(y+(MatrixHeight/2)-1)+'" x2="'+(x+(MatrixWidth/2)-1)+'" y2="'+y+'" stroke="'+color+'" stroke-width="1" />';
      txt += '<line x1="'+x+'" y1="'+(y+(MatrixHeight/2)  )+'" x2="'+(x+(MatrixWidth/2)  )+'" y2="'+y+'" stroke="'+color+'" stroke-width="1" />';
      txt += '<line x1="'+x+'" y1="'+(y+(MatrixHeight/2)+1)+'" x2="'+(x+(MatrixWidth/2)+1)+'" y2="'+y+'" stroke="'+color+'" stroke-width="1" />';
      txt += '<line x1="'+x+'" y1="'+(y+(MatrixHeight/2)+2)+'" x2="'+(x+(MatrixWidth/2)+2)+'" y2="'+y+'" stroke="'+color+'" stroke-width="1" />';
	}
    if ((direction == "L") && (rotate == 1)) { // Left 180 
      txt += '<line x1="'+(x+(MatrixWidth/2)-2)+'" y1="'+(y+MatrixHeight)+'" x2="'+(x+MatrixWidth)+'" y2="'+(y+(MatrixHeight/2)-2)+'" stroke="'+color+'" stroke-width="1" />';
      txt += '<line x1="'+(x+(MatrixWidth/2)-1)+'" y1="'+(y+MatrixHeight)+'" x2="'+(x+MatrixWidth)+'" y2="'+(y+(MatrixHeight/2)-1)+'" stroke="'+color+'" stroke-width="1" />';
      txt += '<line x1="'+(x+(MatrixWidth/2)  )+'" y1="'+(y+MatrixHeight)+'" x2="'+(x+MatrixWidth)+'" y2="'+(y+(MatrixHeight/2)  )+'" stroke="'+color+'" stroke-width="1" />';
      txt += '<line x1="'+(x+(MatrixWidth/2)+1)+'" y1="'+(y+MatrixHeight)+'" x2="'+(x+MatrixWidth)+'" y2="'+(y+(MatrixHeight/2)+1)+'" stroke="'+color+'" stroke-width="1" />';
      txt += '<line x1="'+(x+(MatrixWidth/2)+2)+'" y1="'+(y+MatrixHeight)+'" x2="'+(x+MatrixWidth)+'" y2="'+(y+(MatrixHeight/2)+2)+'" stroke="'+color+'" stroke-width="1" />';
	}
	return txt;
}
 

// --- getSVGturnout
function getSVGturnout(posXinMatrix,  // Matrix box number in X-direction
                       posYinMatrix,  // Matrix box number in Y-direction
					   orientation,   // "H" for Horizontal, "V" for vertical   (vertical not supported)
					   direction,     // "R" for Right, "L" for Left
					   rotate,        // 0 for not rotated, 1 for rotated 180dgr
                       position,      // "C" for Closed, "T" thrown
					   color,         // "black","red",or "green"
					   onclicktxt     // "onSVGclick('<index>')" where <index> replaced with the Cleeswebobjects index nr
						     )
{
	var x = posXinMatrix * MatrixWidth;
	var y = posYinMatrix * MatrixHeight;
    var txt = '';
    if (position == "C") {
      txt += getSVGtrackstraight(posXinMatrix,posYinMatrix,orientation,color);
      if ((orientation == "H") && (direction == "R") && (rotate == 0)){
        txt += '<line x1="'+(x+(MatrixWidth/4)-2)+'" y1="'+(y+(MatrixHeight*3/4))+'" x2="'+(x+(MatrixWidth/2)-2)+'" y2="'+(y+MatrixHeight)+'" stroke="'+color+'" stroke-width="1" />';
        txt += '<line x1="'+(x+(MatrixWidth/4)-1)+'" y1="'+(y+(MatrixHeight*3/4))+'" x2="'+(x+(MatrixWidth/2)-1)+'" y2="'+(y+MatrixHeight)+'" stroke="'+color+'" stroke-width="1" />';
        txt += '<line x1="'+(x+(MatrixWidth/4)  )+'" y1="'+(y+(MatrixHeight*3/4))+'" x2="'+(x+(MatrixWidth/2)  )+'" y2="'+(y+MatrixHeight)+'" stroke="'+color+'" stroke-width="1" />';
        txt += '<line x1="'+(x+(MatrixWidth/4)+1)+'" y1="'+(y+(MatrixHeight*3/4))+'" x2="'+(x+(MatrixWidth/2)+1)+'" y2="'+(y+MatrixHeight)+'" stroke="'+color+'" stroke-width="1" />';
        txt += '<line x1="'+(x+(MatrixWidth/4)+2)+'" y1="'+(y+(MatrixHeight*3/4))+'" x2="'+(x+(MatrixWidth/2)+2)+'" y2="'+(y+MatrixHeight)+'" stroke="'+color+'" stroke-width="1" />';
      }
      if ((orientation == "H") && (direction == "R") && (rotate == 1)){
        txt += '<line x1="'+(x+(MatrixWidth/2)-2)+'" y1="'+y+'" x2="'+(x+(MatrixWidth*3/4)-2)+'" y2="'+(y+(MatrixHeight/4))+'" stroke="'+color+'" stroke-width="1" />';
        txt += '<line x1="'+(x+(MatrixWidth/2)-1)+'" y1="'+y+'" x2="'+(x+(MatrixWidth*3/4)-1)+'" y2="'+(y+(MatrixHeight/4))+'" stroke="'+color+'" stroke-width="1" />';
        txt += '<line x1="'+(x+(MatrixWidth/2)  )+'" y1="'+y+'" x2="'+(x+(MatrixWidth*3/4)  )+'" y2="'+(y+(MatrixHeight/4))+'" stroke="'+color+'" stroke-width="1" />';
        txt += '<line x1="'+(x+(MatrixWidth/2)+1)+'" y1="'+y+'" x2="'+(x+(MatrixWidth*3/4)+1)+'" y2="'+(y+(MatrixHeight/4))+'" stroke="'+color+'" stroke-width="1" />';
        txt += '<line x1="'+(x+(MatrixWidth/2)+2)+'" y1="'+y+'" x2="'+(x+(MatrixWidth*3/4)+2)+'" y2="'+(y+(MatrixHeight/4))+'" stroke="'+color+'" stroke-width="1" />';
      }
      if ((orientation == "H") && (direction == "L") && (rotate == 0)){
        txt += '<line x1="'+(x+(MatrixWidth/4)-2)+'" y1="'+(y+(MatrixHeight/4))+'" x2="'+(x+(MatrixWidth/2)-2)+'" y2="'+y+'" stroke="'+color+'" stroke-width="1" />';
        txt += '<line x1="'+(x+(MatrixWidth/4)-1)+'" y1="'+(y+(MatrixHeight/4))+'" x2="'+(x+(MatrixWidth/2)-1)+'" y2="'+y+'" stroke="'+color+'" stroke-width="1" />';
        txt += '<line x1="'+(x+(MatrixWidth/4)  )+'" y1="'+(y+(MatrixHeight/4))+'" x2="'+(x+(MatrixWidth/2)  )+'" y2="'+y+'" stroke="'+color+'" stroke-width="1" />';
        txt += '<line x1="'+(x+(MatrixWidth/4)+1)+'" y1="'+(y+(MatrixHeight/4))+'" x2="'+(x+(MatrixWidth/2)+1)+'" y2="'+y+'" stroke="'+color+'" stroke-width="1" />';
        txt += '<line x1="'+(x+(MatrixWidth/4)+2)+'" y1="'+(y+(MatrixHeight/4))+'" x2="'+(x+(MatrixWidth/2)+2)+'" y2="'+y+'" stroke="'+color+'" stroke-width="1" />';
      }
      if ((orientation == "H") && (direction == "L") && (rotate == 1)){
        txt += '<line x1="'+(x+(MatrixWidth/2)-2)+'" y1="'+(y+MatrixHeight)+'" x2="'+(x+(MatrixWidth*3/4)-2)+'" y2="'+(y+(MatrixHeight*3/4))+'" stroke="'+color+'" stroke-width="1" />';
        txt += '<line x1="'+(x+(MatrixWidth/2)-1)+'" y1="'+(y+MatrixHeight)+'" x2="'+(x+(MatrixWidth*3/4)-1)+'" y2="'+(y+(MatrixHeight*3/4))+'" stroke="'+color+'" stroke-width="1" />';
        txt += '<line x1="'+(x+(MatrixWidth/2)  )+'" y1="'+(y+MatrixHeight)+'" x2="'+(x+(MatrixWidth*3/4)  )+'" y2="'+(y+(MatrixHeight*3/4))+'" stroke="'+color+'" stroke-width="1" />';
        txt += '<line x1="'+(x+(MatrixWidth/2)+1)+'" y1="'+(y+MatrixHeight)+'" x2="'+(x+(MatrixWidth*3/4)+1)+'" y2="'+(y+(MatrixHeight*3/4))+'" stroke="'+color+'" stroke-width="1" />';
        txt += '<line x1="'+(x+(MatrixWidth/2)+2)+'" y1="'+(y+MatrixHeight)+'" x2="'+(x+(MatrixWidth*3/4)+2)+'" y2="'+(y+(MatrixHeight*3/4))+'" stroke="'+color+'" stroke-width="1" />';
      }
	}
    if (position == "T") {
      if ((orientation == "H") && (direction == "R") && (rotate == 0)){
		// curve  
        txt += getSVGtrackcurve(posXinMatrix,posYinMatrix,direction,rotate,color);
        // reduced stratight
        txt += '<line x1="'+(x+(MatrixWidth/4))+'" y1="'+(y+(MatrixHeight/2)-2)+'" x2="'+(x+MatrixWidth)+'" y2="'+(y+(MatrixHeight/2)-2)+'" stroke="'+color+'" stroke-width="1" />';
        txt += '<line x1="'+(x+(MatrixWidth/4))+'" y1="'+(y+(MatrixHeight/2)-1)+'" x2="'+(x+MatrixWidth)+'" y2="'+(y+(MatrixHeight/2)-1)+'" stroke="'+color+'" stroke-width="1" />';
        txt += '<line x1="'+(x+(MatrixWidth/4))+'" y1="'+(y+(MatrixHeight/2)  )+'" x2="'+(x+MatrixWidth)+'" y2="'+(y+(MatrixHeight/2)  )+'" stroke="'+color+'" stroke-width="1" />';
        txt += '<line x1="'+(x+(MatrixWidth/4))+'" y1="'+(y+(MatrixHeight/2)+1)+'" x2="'+(x+MatrixWidth)+'" y2="'+(y+(MatrixHeight/2)+1)+'" stroke="'+color+'" stroke-width="1" />';
        txt += '<line x1="'+(x+(MatrixWidth/4))+'" y1="'+(y+(MatrixHeight/2)+2)+'" x2="'+(x+MatrixWidth)+'" y2="'+(y+(MatrixHeight/2)+2)+'" stroke="'+color+'" stroke-width="1" />';
      }	
      if ((orientation == "H") && (direction == "R") && (rotate == 1)){
		// curve  
        txt += getSVGtrackcurve(posXinMatrix,posYinMatrix,direction,rotate,color);
        // reduced stratight
        txt += '<line x1="'+x+'" y1="'+(y+(MatrixHeight/2)-2)+'" x2="'+(x+(MatrixWidth*3/4))+'" y2="'+(y+(MatrixHeight/2)-2)+'" stroke="'+color+'" stroke-width="1" />';
        txt += '<line x1="'+x+'" y1="'+(y+(MatrixHeight/2)-1)+'" x2="'+(x+(MatrixWidth*3/4))+'" y2="'+(y+(MatrixHeight/2)-1)+'" stroke="'+color+'" stroke-width="1" />';
        txt += '<line x1="'+x+'" y1="'+(y+(MatrixHeight/2)  )+'" x2="'+(x+(MatrixWidth*3/4))+'" y2="'+(y+(MatrixHeight/2)  )+'" stroke="'+color+'" stroke-width="1" />';
        txt += '<line x1="'+x+'" y1="'+(y+(MatrixHeight/2)+1)+'" x2="'+(x+(MatrixWidth*3/4))+'" y2="'+(y+(MatrixHeight/2)+1)+'" stroke="'+color+'" stroke-width="1" />';
        txt += '<line x1="'+x+'" y1="'+(y+(MatrixHeight/2)+2)+'" x2="'+(x+(MatrixWidth*3/4))+'" y2="'+(y+(MatrixHeight/2)+2)+'" stroke="'+color+'" stroke-width="1" />';
      }	
      if ((orientation == "H") && (direction == "L") && (rotate == 0)){
		// curve  
        txt += getSVGtrackcurve(posXinMatrix,posYinMatrix,direction,rotate,color);
        // reduced stratight
        txt += '<line x1="'+(x+(MatrixWidth/4))+'" y1="'+(y+(MatrixHeight/2)-2)+'" x2="'+(x+MatrixWidth)+'" y2="'+(y+(MatrixHeight/2)-2)+'" stroke="'+color+'" stroke-width="1" />';
        txt += '<line x1="'+(x+(MatrixWidth/4))+'" y1="'+(y+(MatrixHeight/2)-1)+'" x2="'+(x+MatrixWidth)+'" y2="'+(y+(MatrixHeight/2)-1)+'" stroke="'+color+'" stroke-width="1" />';
        txt += '<line x1="'+(x+(MatrixWidth/4))+'" y1="'+(y+(MatrixHeight/2)  )+'" x2="'+(x+MatrixWidth)+'" y2="'+(y+(MatrixHeight/2)  )+'" stroke="'+color+'" stroke-width="1" />';
        txt += '<line x1="'+(x+(MatrixWidth/4))+'" y1="'+(y+(MatrixHeight/2)+1)+'" x2="'+(x+MatrixWidth)+'" y2="'+(y+(MatrixHeight/2)+1)+'" stroke="'+color+'" stroke-width="1" />';
        txt += '<line x1="'+(x+(MatrixWidth/4))+'" y1="'+(y+(MatrixHeight/2)+2)+'" x2="'+(x+MatrixWidth)+'" y2="'+(y+(MatrixHeight/2)+2)+'" stroke="'+color+'" stroke-width="1" />';
      }	
      if ((orientation == "H") && (direction == "L") && (rotate == 1)){
		// curve  
        txt += getSVGtrackcurve(posXinMatrix,posYinMatrix,direction,rotate,color);
        // reduced stratight
        txt += '<line x1="'+x+'" y1="'+(y+(MatrixHeight/2)-2)+'" x2="'+(x+(MatrixWidth*3/4))+'" y2="'+(y+(MatrixHeight/2)-2)+'" stroke="'+color+'" stroke-width="1" />';
        txt += '<line x1="'+x+'" y1="'+(y+(MatrixHeight/2)-1)+'" x2="'+(x+(MatrixWidth*3/4))+'" y2="'+(y+(MatrixHeight/2)-1)+'" stroke="'+color+'" stroke-width="1" />';
        txt += '<line x1="'+x+'" y1="'+(y+(MatrixHeight/2)  )+'" x2="'+(x+(MatrixWidth*3/4))+'" y2="'+(y+(MatrixHeight/2)  )+'" stroke="'+color+'" stroke-width="1" />';
        txt += '<line x1="'+x+'" y1="'+(y+(MatrixHeight/2)+1)+'" x2="'+(x+(MatrixWidth*3/4))+'" y2="'+(y+(MatrixHeight/2)+1)+'" stroke="'+color+'" stroke-width="1" />';
        txt += '<line x1="'+x+'" y1="'+(y+(MatrixHeight/2)+2)+'" x2="'+(x+(MatrixWidth*3/4))+'" y2="'+(y+(MatrixHeight/2)+2)+'" stroke="'+color+'" stroke-width="1" />';
      }	
    }
	txt += '<rect x="'+x+'" y="'+y+'" width="'+MatrixWidth+'" height="'+MatrixHeight+'" style="opacity:0" onclick="'+onclicktxt+'" />';
    return txt;
}




