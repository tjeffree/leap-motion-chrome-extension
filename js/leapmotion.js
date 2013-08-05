var html = document.getElementsByTagName('html')[0];

// Whether Current Tab Has Focus
var tab_has_focus = false;

// Leap Motion Settings
var run = true;
var last_frame;
var action = null;
var last_action = null;

// Track Leap Motion Connection
var now, last_poll = null;
var connection;
var connection_lost_after = 5;

// Settings for Scroll Events
var width = window.innerWidth;
var height = window.innerHeight;
var scroll_speed = 15;
var donavigate = true;

// Size for Finger Rendering in Pixels
var finger_size = 32;

// Colors for Fingers
var rainbow = new Array('#F80C12', '#FF3311', '#FF6644', '#FEAE2D', '#D0C310', '#69D025', '#12BDB9', '#4444DD', '#3B0CBD', '#442299');
var leap = '#9AC847';
var dark = '#000000';
var light = '#FFFFFF';

var $allFingers = [];
var fingersGone = false;

var lastCircleGesture = null;

// Setup Default Settings for Leap Motion
var leap_motion_settings = {
    'fingers': 'yes',
    'color': 'rainbow',
    'scrolling': 'enabled',
    'refresh': 'enabled',
    'close': 'disabled',
    'history': 'enabled',
    'zoom': 'disabled',
    'rotation': 'disabled'
};

var baseCSS = 
    '.leap_motion_connection {' +
        'position: fixed;' +
        'top: 0;' +
        'left: 0;' +
        'width: 100%;' +
        'color: #222;' +
        'text-align: center;' +
        'height: 30px;' +
        'z-index: 1000;' +
        'line-height: 30px;' +
        'background-color: #9AC847; }' +
    
    '.chrome-leap-finger {' +
        'width:' + finger_size + 'px;' +
        'height:' + finger_size + 'px;' +
        '-webkit-border-radius: ' + Math.ceil(finger_size/2) + 'px;' +
        'border-radius: ' + Math.ceil(finger_size/2) + 'px;' +
        'position: fixed;' +
        'z-index: 10000;' +
        'opacity: 0;' +
        '-webkit-transition: opacity 0.15s ease;' +
        'transition: opacity 0.15s ease;' +
        '-webkit-box-sizing: border-box;' +
        'box-sizing: border-box;' +
        'transform: translate3d(0,0,0); }' +
    
    '.chrome-leap-finger-rainbow {' +
        '-webkit-box-shadow: inset 0px 0px 1px 1px rgba(0, 0, 0, 0.25);' +
        'box-shadow: inset 0px 0px 1px 1px rgba(0, 0, 0, 0.25); }' +
    
    '.chrome-leap-finger-leap {' +
        'background-color: ' + leap + ';' +
        '-webkit-box-shadow: inset 0 0 5px #000;' +
        'box-shadow: inner 0 0 5px #000; }' +
    
    '.chrome-leap-finger-dark {' +
        'background-color: ' + dark + ';' +
        '-webkit-box-shadow: inset 0px 0px 1px 1px rgba(255, 255, 255, 0.5);' +
        'box-shadow: inset 0px 0px 1px 1px rgba(255, 255, 255, 0.5); }' +
    
    '.chrome-leap-finger-light {' +
        'background-color: ' + light + ';' +
        '-webkit-box-shadow: inset 0px 0px 1px 1px rgba(0, 0, 0, 0.25);' +
        'box-shadow: inset 0px 0px 1px 1px rgba(0, 0, 0, 0.25) }';

// Add the CSS to the page
var headStyle = document.createElement('style');
headStyle.setAttribute('type','text/css');
headStyle.appendChild(document.createTextNode(baseCSS));
document.head.appendChild(headStyle);

// Update Settings from Browser Extension
update_settings();

if ("storage" in chrome) {
    // called when a tab is updated (like changed away from, or refreshed, or loaded)
    chrome.storage.onChanged.addListener(update_settings);
}

// Update the width and height if the window is resized
window.addEventListener('resize', function() {
    width = window.innerWidth;
    height = window.innerHeight;
}, false);

// Catch focus events to more quickly update the focus status
window.addEventListener('focus', function() { tab_has_focus = true;  });
window.addEventListener('blur' , function() { tab_has_focus = false; });

// Inteval like method using animation frames - so it won't be checking when not in focus
// https://gist.github.com/joelambert/1002116
function requestInterval(fn, delay) {
    var start = new Date().getTime(),
        handle = {stop: false};

    function loop() {
        if (!handle.stop) {
            
            var current = new Date().getTime(),
                delta = current - start;
                
            if(delta >= delay) {
                fn.call();
                start = new Date().getTime();
            }
     
            handle.value = requestAnimationFrame(loop);
        }
    };
    
    handle.value = requestAnimationFrame(loop);
    return handle;
}

function clearRequestInterval(handle) {
    handle.stop = true;
    window.cancelAnimationFrame(handle.value);
};

// Once Settings are Updates, Initialize Extension
function init()
{
    if(leap_motion_settings.fingers === 'yes')
    {
        add_fingers();
    }

    connection = requestInterval(runInterval, 1000);
    
}

// Single interval method to check the connection and focus status
function runInterval()
{
    if (!run)
    {
        // Not running, so don't check
        clearRequestInterval(connection);
        return;
    }
    
    check_connection();
    check_focus();
}

// Sometimes The Connection Dies, and Leap Motion Needs to be Restarted
function check_connection()
{   
    now = Date.now() / 1000;
    
    // Mostly I have only had to refresh the page to make the Leap work after losing connection
    // Can probably attempt a reconnect here first
    
    if(last_poll !== null && now - last_poll > connection_lost_after)
    {
        clearRequestInterval(connection);
        run = false;

        try {
            
            if (!("runtime" in chrome)) {
                // Not being run as an extension
                console.error('Connection to Leap Motion Lost. Restart Leap Motion and Refresh Page.');
                return;
            }
            
            chrome.runtime.sendMessage({ connection: 'lost' }, function(response) {
                console.error('Connection to Leap Motion Lost. Restart Leap Motion and Refresh Page.');
                
                var leapDiv = document.createElement('div');
                leapDiv.className = 'leap_motion_connection';
                leapDiv.innerHTML = '<b>ATTENTION:<\/b> Connection to Leap Motion Lost. Restart Leap Motion and Refresh Page.';
                
                document.body.appendChild(leapDiv);
                
                document.getElementsByClassName('leap_motion_connection')[0].addEventListener('click', function() {
                    this.style.display = 'none';
                }, false);
                
            });
        }
        catch(error) {
            console.error(error.message);
        }
    }
}

// Check if Current Tab has Focus, and only run this extension on the active tab
function check_focus()
{
    
    if (!("runtime" in chrome)) {
        // Not being run as an extension
        tab_has_focus = document.hasFocus();
        return;
    }
    
    try {
        chrome.runtime.sendMessage({ tab_status: 'current' }, function(response) {
            if(response.active && window.location.href == response.url && document.hasFocus())
            {
                tab_has_focus = true;
            }
            else
            {
                tab_has_focus = false;
            }
        });
    }
    catch(error) {
        // If you clicked to reload this extension, you will get this error, which a refresh fixes
        if(error.message.indexOf('Error connecting to extension') !== -1)
        {
            refresh_page();
        }
        // Something else went wrong... I blame Grumpy Cat
        else
        {
            console.error(error.message);
        }
    }
}

// Add DOM Elements to Page to Render Fingers
function add_fingers()
{
    var fingerD = document.createElement('div');
        fingerD.id = 'chrome-leap-fingercontainer';
    var finger = document.createElement('div'), thisFinger,
        cssString;
    
    for(var i=0; i<10; i++)
    {
        thisFinger = finger.cloneNode();
        thisFinger.id = 'chrome-leap-finger'+ (i+1);
        
        if (leap_motion_settings.color==='rainbow')
        {
            thisFinger.style.cssText = 'background-color: ' + rainbow[i] + ';';
        }
        
        thisFinger.className = 'chrome-leap-finger chrome-leap-finger-' + leap_motion_settings.color;
        
        fingerD.appendChild(thisFinger);
    }
    
    document.body.appendChild(fingerD);
    
    // Save all fingers for later
    $allFingers = document.getElementsByClassName('chrome-leap-finger');

}

function hideFingers() {
    if(leap_motion_settings.fingers === 'yes') {
        
        if ($allFingers[0] === undefined)
        {
            // Fingers have been removed
            return;
        }
        
        for(var i=0; i<10; i++)
        {
            $allFingers[i].style.opacity = 0;
        }
        
    }
}

// Track Finger Movement and Update in Real Time
function update_fingers(scale, frame)
{
    if (fingersGone)
    {
        return;
    }
    
    hideFingers();

    var scaled_size = Math.ceil(finger_size * scale);
    var scaled_half = Math.ceil(scaled_size / 2);
    
    if ($allFingers[0] === undefined)
    {
        // Fingers have been removed
        return;
    }

    // Make sure there are at least two fingers to render, since that is the minimum for an action
    // Also prevents forehead / face from registering as a finger during typing
    if(frame.fingers.length > 0)
    {
        for(var j=0; j<frame.fingers.length && j<10; j++)
        {
            var left = ( width / 2 ) + frame.fingers[j].tipPosition[0];
            var top = ( height / 2 ) - frame.fingers[j].tipPosition[1];
            
            $allFingers[j].style.top = "0";
            $allFingers[j].style.left = "0";
            $allFingers[j].style.transform = 'translate3d('+left.toFixed(2)+'px, '+top.toFixed(2)+'px, 0)';
            $allFingers[j].style.webkitTransform = 'translate3d('+left.toFixed(2)+'px, '+top.toFixed(2)+'px, 0)';
            $allFingers[j].style.opacity = 0.75;
            
        }
        
    }
}

// Circle Scrolling
function scroll_page_circle(gesture, frame)
{
    
    if (
        leap_motion_settings.scrolling === 'disabled' 
        || frame.pointablesMap === undefined
        || gesture.pointableIds.length === 0
        || frame.pointablesMap[gesture.pointableIds[0]] === undefined
        || !('direction' in frame.pointablesMap[gesture.pointableIds[0]])
        || last_frame === undefined || last_frame.pointables.length === 0
    ) {
        return;
    }
    
//    gesture.isClockwise  = frame.pointablesMap[gesture.pointableIds[0]].direction.angleTo(gesture.normal) <= Math.PI/4;
    
    var vector          = new Vector(frame.finger(gesture.pointableIds[0]).direction);
    gesture.isClockwise = vector.angleTo(new Vector(gesture.normal))<=Math.PI/4;
    
    if (lastCircleGesture==null || gesture.isClockwise!==lastCircleGesture.isClockwise || gesture.id!==lastCircleGesture.id)
    {
        lastCircleGesture = gesture;
        return;
    }
    
    var speed = scroll_speed;
    
    if (gesture.radius < 30) speed = speed/1.5;   // small circle - slower scroll
    if (gesture.radius > 35) speed = speed*2.5;   // big circle - faster scroll
    
    var scroll_distance = (gesture.progress - lastCircleGesture.progress) * 10 * speed;
    
    // Ignore no-scroll or massive-scroll
    if (scroll_distance > 100 || scroll_distance <= 0)
    {
        lastCircleGesture = gesture;
        return;
    }
    
    // Check direction of circle
    if ( !gesture.isClockwise )
    {        
        scroll_distance = -scroll_distance;
    }
    
    window.scrollBy(0, scroll_distance);
    
    // If we have finished the gesture, just reset
    if (gesture.state === 'stop')
    {
        lastCircleGesture = null;
    } else 
    {
        lastCircleGesture = gesture;
    }
    
}

// Look for Hand Gestures to Navigate History
function handle_swipe(gesture, frame)
{
    
    if( gesture.handIds.length===0 || !donavigate )
    {
        return;
    }
    
    var translation = Math.abs(gesture.position[0] - gesture.startPosition[1]);
    
    if (translation < 100)
    {
        // small swipe, ignore it
        return;
    }
    
    if (gesture.direction[0] > 0)
    {
        history.forward();
    }
    else
    {
        history.back();
    }
    
    // Disable any more navigation for a short time
    donavigate = false;
    setTimeout(function() { donavigate = true; }, 300);
}

// Fetch Settings from Local Storage
function update_settings()
{   
    if (!("storage" in chrome)) {
        // Not running in extension or anywhere with storage.. just initialise and cross your fingers
        init();
        return;
    }
    
    chrome.storage.local.get([
        'leap_motion_fingers', 
        'leap_motion_color', 
        'leap_motion_scrolling', 
        'leap_motion_history'
    ], function(data) {
        
        for (var setting in data) {
            
            if(typeof data[setting] !== 'undefined')
            {
                var key = setting.substr(setting.lastIndexOf('_')+1);
                leap_motion_settings[key] = data[setting];
            }
        }
        
        init();
    });
    
}

// Connect to Leap Motion via Web Socket and Manage Actions
var ctl = new Leap.Controller({enableGestures: true});

ctl.on('frame', function() {
    
    var frame = ctl.frame(0);
    
    if (!run)
    {
        // Switched off
        return;
    }
    
    var scale,
        now = Date.now() / 1000;

    last_poll = now;
    
    // Update Finger Position
    if(leap_motion_settings.fingers === 'yes' && tab_has_focus)
    {
        scale = (frame.hands.length > 0 && frame.hands[0]._scaleFactor !== 'undefined') ? frame.hands[0]._scaleFactor : 1;
        update_fingers(scale, frame);
    }
    else if (!fingersGone)
    {
        hideFingers();
    }

    // If nothing is happening, reset interaction
    if (frame.pointables === undefined || !tab_has_focus)
    {
        action = null;
        return;
    }

    // Look for Swipe Gesture
    if (frame.gestures && frame.gestures.length > 0)
    {
        action = 'gesture';
    }
    // Nothing is happening, reset actions
    else
    {
        action = null;
    }

    if(action!==null)
    {
        switch(action)
        {
            case 'gesture':
                // Gestures are pointable based so often there are many per frame - just get the first gesture
                var gesture = frame.gestures[0];
        
                // Catch circle gestures for scrolling
                if (gesture.type === 'circle') {
                    scroll_page_circle(gesture, frame);
                    break;
                }
        
                // Catch the swipe gestures for navigation
                if (gesture.type === 'swipe' && gesture.state === 'stop') {
                    handle_swipe(gesture, frame);
                    break;
                }
                
                break;
        }
    }

    if (frame !== undefined && frame.pointables !== undefined && frame.pointables.length > 0)
    {
        last_frame = frame;
        last_action = action;
    }

});

ctl.connect();

// Stripped down Vector class from older version of leapjs library
// (https://github.com/leapmotion/leapjs/commit/acda94854310e28af0c02432f3b1906aa242c616)
var Vector = function(data){
	if(data == null){
		this.x = 0;
		this.y = 0;
		this.z = 0;
	}
	else if("x" in data){
		this.x = data.x;
		this.y = data.y;
		this.z = data.z;
	}
	else if("0" in data){
		this.x = (typeof(data[0]) == "number")?data[0]:0;
		this.y = (typeof(data[1]) == "number")?data[1]:0;
		this.z = (typeof(data[2]) == "number")?data[2]:0;
	}
};

Vector.prototype = {
	
	angleTo : function(other){
		var denom = this.magnitude()*other.magnitude();
		if(denom > 0) return Math.acos(this.dot(other)/denom);
		else return 0;
	},
	
	dot : function(other){
		return this.x*other.x + this.y*other.y + this.z*other.z;
	},
	
	magnitude : function(){
		return Math.sqrt(Math.pow(this.x,2) + Math.pow(this.y,2) + Math.pow(this.z,2));
	}
};
