var html = document.getElementsByTagName('html')[0];

// Whether Current Tab Has Focus
var tab_has_focus = true;

// Leap Motion Settings
var run = true;
var last_frame;
var scene;
var action = null;
var last_action = null;
var start_action = 0;
var intent = false;
var delay_between_actions = 0.3;
var timeout = null;

// Track Leap Motion Connection
var now, last_poll = Date.now() / 1000;
var connection;
var connection_lost_after = 5;

// Settings for Scroll Events
var width = window.innerWidth;
var height = window.innerHeight;
var scroll_speed = 10;
var scroll_smoothing = 4;
var donavigate = true;

// Size for Finger Rendering in Pixels
var finger_size = 32;

// Colors for Fingers
var rainbow = new Array('#F80C12', '#FF3311', '#FF6644', '#FEAE2D', '#D0C310', '#69D025', '#12BDB9', '#4444DD', '#3B0CBD', '#442299');
var leap = '#9AC847';
var dark = '#000000';
var light = '#FFFFFF';

var $allFingers;
var fingersGone = false;

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
    
    '.finger {' +
        'width:' + finger_size + 'px;' +
        'height:' + finger_size + 'px;' +
        '-webkit-border-radius: ' + Math.ceil(finger_size/2) + 'px;' +
        'border-radius: ' + Math.ceil(finger_size/2) + 'px;' +
        'opacity: 0;' +
        'position: fixed;' +
        'z-index: 10000;' +
        '-webkit-transition: opacity 0.15s ease;' +
        'transition: opacity 0.15s ease;' +
        '-webkit-box-sizing: border-box;' +
        'box-sizing: border-box;' +
        'transform: translate3d(0,0,0); }' +
    
    '.finger-rainbow {' +
        '-webkit-box-shadow: inset 0px 0px 1px 1px rgba(0, 0, 0, 0.25);' +
        'box-shadow: inset 0px 0px 1px 1px rgba(0, 0, 0, 0.25); }' +
    
    '.finger-leap {' +
        'background-color: ' + leap + ';' +
		'-webkit-box-shadow: inset 0 0 5px #000;' +
        'box-shadow: inner 0 0 5px #000; }' +
    
    '.finger-dark {' +
        'background-color: ' + dark + ';' +
		'-webkit-box-shadow: inset 0px 0px 1px 1px rgba(255, 255, 255, 0.5);' +
        'box-shadow: inset 0px 0px 1px 1px rgba(255, 255, 255, 0.5); }' +
    
    '.finger-light {' +
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
    
	if(now - last_poll > connection_lost_after)
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
    var fingerD = document.createDocumentFragment();
    var finger = document.createElement('div'), thisFinger,
        cssString;
    
	for(var i=0; i<10; i++)
	{
        thisFinger = finger.cloneNode();
        thisFinger.id = 'finger'+ (i+1);
        
        if (leap_motion_settings.color==='rainbow')
        {
            thisFinger.style.cssText = 'background-color: ' + rainbow[i] + ';';
		}
        
        thisFinger.className = 'finger finger-' + leap_motion_settings.color;
        
        fingerD.appendChild(thisFinger);
	}
    
    document.body.appendChild(fingerD);
    
    // Save all fingers for later
    $allFingers = document.getElementsByClassName('finger');

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
    
	if( !tab_has_focus)
	{
		return;
	}

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
			var top = ( height / 2 ) - frame.fingers[j].tipPosition.y;
			var left = ( width / 2 ) + frame.fingers[j].tipPosition.x;
            
            $allFingers[j].style.top = "0";
            $allFingers[j].style.left = "0";
            $allFingers[j].style.transform = 'translate3d('+left.toFixed(2)+'px, '+top.toFixed(2)+'px, 0)';
            $allFingers[j].style.webkitTransform = 'translate3d('+left.toFixed(2)+'px, '+top.toFixed(2)+'px, 0)';
            $allFingers[j].style.opacity = "0.75";
            
		}
	}
}

// Two Finger Page Scrolling
function scroll_page(pointables)
{
	if( !tab_has_focus || leap_motion_settings.scrolling === 'disabled' || pointables === undefined || pointables.length === 0 || last_frame === undefined || last_frame.pointables.length === 0)
	{
		return;
	}

	var finger = pointables[0];
	var last_finger = last_frame.pointables[0];


	var horizontal_translation = 0;
	var horizontal_delta = finger.tipPosition.x - last_finger.tipPosition.x;

	var vertical_translation = 0;
	var vertical_delta = finger.tipPosition.y - last_finger.tipPosition.y;

	if (horizontal_delta > 10)
	{
		horizontal_translation = scroll_speed;
	}
	else if (horizontal_delta < 10)
	{
		horizontal_translation = -scroll_speed;
	}

	if (vertical_delta > scroll_smoothing)
	{
		vertical_translation = scroll_speed;
	}
	else if (vertical_delta < -scroll_smoothing)
	{
		vertical_translation = -scroll_speed;
	}

	window.scrollBy(horizontal_translation, vertical_translation);
}

// Look for Hand Gestures to Navigate History
function handle_gesture(gesture, frame)
{
    
	if( !tab_has_focus || typeof gesture === 'undefined')
	{
		return;
	}

	if (gesture.type === 'circle')
	{   
        // Check direction of circle
        if (leap_motion_settings.refresh === 'enabled' && frame.pointablesMap[gesture.pointableIds[0]].direction.angleTo(gesture.normal) <= Math.PI/4) {
            
            // Refresh on clockwise
		    refresh_page();
            
        } else if (leap_motion_settings.close === 'enabled') {
            
            // Close window on an anti-clock circle
            window.open('', '_self', '');
            window.close();
            
        }

        return;
	}

	if (gesture.type === 'swipe')
	{
		navigate_history(gesture);
        return;
	}
}

function navigate_history(gesture)
{
    if (!donavigate)
    {
        // We have only just navigated - don't do it again
        return;
    }
    
    if (gesture.direction.x > 0)
    {
        history.forward();
    }
    else
    {
        history.back();
    }
    
    // Disable any more navigation for a short time
    donavigate = false;
    setTimeout(function() { donavigate = true; }, 500);
}

function refresh_page()
{
    document.location.reload(true);
}

// Look for Hand Gestures to Transform Page
function page_transform(hands)
{
	if ( !tab_has_focus || hands === undefined || hands.length === 0 || (leap_motion_settings.zoom === 'disabled' && leap_motion_settings.rotation === 'disabled'))
	{
		return;
	}

	var hand = hands[0];
	var rotation = (Math.atan(-hand.palmNormal.x, -hand.palmNormal.y)) * (180 / Math.PI);
    var transform = null, transformOrigin = null;

	// Both Zoom and Rotation are Enables
	if(leap_motion_settings.zoom === 'enabled' && leap_motion_settings.rotation === 'enabled')
	{
        transform = 'scale(' + hand._scaleFactor + ') rotate('+ rotation +'deg) translateZ(0)'; /* W3C */
        transformOrigin = 'center center';
	}
	// Only Zoom is Enabled
	else if(leap_motion_settings.zoom === 'enabled' && leap_motion_settings.rotation === 'disabled')
	{
        transform = 'scale(' + hand._scaleFactor + ') translateZ(0)'; /* W3C */
        transformOrigin = 'center center';
	}
	// Only Rotation is Enabled
	else if(leap_motion_settings.zoom === 'disabled' && leap_motion_settings.rotation === 'enabled')
	{
        transform = 'rotate('+ rotation +'deg) translateZ(0)'; /* W3C */
        transformOrigin = 'center center';
	}
    
    html.style.transform = transform;
    html.style.transformOrigin = transformOrigin;
    
    html.style.webkitTransform = transform;
    html.style.wekkitTransformOrigin = transformOrigin;
}

// Fetch Settings from Local Storage
function update_settings()
{
    if (!("storage" in chrome)) {
        // Not running in extension or anywhere with storage.. just initialise and cross your fingers
        init();
        return;
    }
    
	// Fetch Leap Motion Settings for Fingers
	chrome.storage.local.get('leap_motion_fingers', function(fetchedData) {
		if(typeof fetchedData.leap_motion_fingers !== 'undefined')
		{
			leap_motion_settings.fingers = fetchedData.leap_motion_fingers;
		}
	});

	// Fetch Leap Motion Settings for Color
	chrome.storage.local.get('leap_motion_color', function(fetchedData) {
		if(typeof fetchedData.leap_motion_color !== 'undefined')
		{
			leap_motion_settings.color = fetchedData.leap_motion_color;
		}
	});

	// Fetch Leap Motion Settings for Scrolling
	chrome.storage.local.get('leap_motion_scrolling', function(fetchedData) {
		if(typeof fetchedData.leap_motion_scrolling !== 'undefined')
		{
			leap_motion_settings.scrolling = fetchedData.leap_motion_scrolling;
		}
	});

	// Fetch Leap Motion Settings for History
	chrome.storage.local.get('leap_motion_history', function(fetchedData) {
		if(typeof fetchedData.leap_motion_history !== 'undefined')
		{
			leap_motion_settings.history = fetchedData.leap_motion_history;
		}
	});

	// Fetch Leap Motion Settings for Refresh
	chrome.storage.local.get('leap_motion_refresh', function(fetchedData) {
		if(typeof fetchedData.leap_motion_refresh !== 'undefined')
		{
			leap_motion_settings.refresh = fetchedData.leap_motion_refresh;
		}
	});

	// Fetch Leap Motion Settings for Close
	chrome.storage.local.get('leap_motion_close', function(fetchedData) {
		if(typeof fetchedData.leap_motion_close !== 'undefined')
		{
			leap_motion_settings.close = fetchedData.leap_motion_close;
		}
	});

	// Fetch Leap Motion Settings for Zoom
	chrome.storage.local.get('leap_motion_zoom', function(fetchedData) {
		if(typeof fetchedData.leap_motion_zoom !== 'undefined')
		{
			leap_motion_settings.zoom = fetchedData.leap_motion_zoom;
		}
	});

	// Fetch Leap Motion Settings for Rotation
	chrome.storage.local.get('leap_motion_rotation', function(fetchedData) {
		if(typeof fetchedData.leap_motion_rotation !== 'undefined')
		{
			leap_motion_settings.rotation = fetchedData.leap_motion_rotation;
		}

		// Run initialization after last setting pulled from local storage
		init();
	});
}

// Connect to Leap Motion via Web Socket and Manage Actions
Leap.loop({enableGestures: true}, function (frame, done){
    
    if (!run)
    {
        // Switched off
        return;
    }
    
	var offset, scale,
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

	// Try to detect User Intent to reduce firing events not intended ( less jumpy page is good )
    
	if(start_action === 0)
	{
		start_action = now;
	}

	offset = now - start_action;

	// If nothing is happening, reset interaction
	if (frame.pointables === undefined)
	{
		action = null;
		clearTimeout(timeout);
        
		return;
	}

	// Look for Swipe Gesture
	if (frame.gestures && frame.gestures.length > 0)
	{
		action = 'gesture';
	}
	// Look for Scrolling Gesture
	else if (frame.pointables.length === 2 || frame.pointables.length === 3)
	{
		action = 'scroll';
	}
	// Look for Page Transform Gesture
	else if (frame.pointables.length > 2)
	{
		action = 'transform';
	}
	// Nothing is happening, reset actions
	else
	{
		action = null;
//		clearTimeout(timeout);
	}

	if(action === last_action && offset >= delay_between_actions)
	{
		intent = true;
	}
	else if(action !== last_action && offset >= delay_between_actions)
	{
		intent = false;
		start_action = 0;
//		clearTimeout(timeout);
	}

	if(intent && tab_has_focus)
	{
		switch(action)
		{
			case 'gesture':
                
                // Gestures are pointable based so often there are many per frame - just get the first gesture
                var gesture = frame.gestures[0];
                
                // We have to catch the stops - otherwise we won't do anything at all
                if (gesture.state === 'stop') {
                    if (gesture.type === 'circle') {
                        // Circles tend not to fire with a higher timeout here
                        timeout = setTimeout(function(){ handle_gesture(gesture, frame); }, 1);
                    } else {
                        // But swipes fire too much
                        timeout = setTimeout(function(){ handle_gesture(gesture, frame); }, 150);
                    }
                }
				break;

			case 'scroll':
				timeout = setTimeout(function(){ scroll_page(frame.pointables); }, 250);
				break;

			case 'transform':
				timeout = setTimeout(function(){ page_transform(frame.hands); }, 250);
				break;
		}
	}

	if (frame !== undefined && frame.pointables !== undefined && frame.pointables.length > 0)
	{
		last_frame = frame;
		last_action = action;
	}

	done();
});
