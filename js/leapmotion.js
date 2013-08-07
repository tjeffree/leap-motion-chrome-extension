function leapMotionChromeExtension(){}
(function() {
    
    var ENABLED  = "enabled",
        DISABLED = "disabled",
        YES      = "yes",
    
    // Whether Current Tab Has Focus
        tab_has_focus = false,
    
    // Leap Motion Settings
        run         = true,
        action      = null,
        retry       = 0,
        last_action = null,
        last_frame,
    
    // Track Leap Motion Connection
        now, 
        last_poll = null,
        connection,
        connection_lost_after = 5,
    
    // Settings for Scroll Events
        width               = window.innerWidth,
        height              = window.innerHeight,
        scroll_speed        = 15,
        scroll_direction    = null,
        scroll_timeout      = null,
        scroll_finger       = null,
        donavigate          = true,
    
    // Size for Finger Rendering in Pixels
        finger_size = 20,
    
    // Colors for Fingers
        rainbow = new Array('#F80C12', '#FF3311', '#FF6644', '#FEAE2D', '#D0C310', '#69D025', '#12BDB9', '#4444DD', '#3B0CBD', '#442299'),
        leap    = '#9AC847',
        dark    = '#000000',
        light   = '#FFFFFF',
    
    // Keep track of the finger situation
        $allFingers = [],
        fingersGone = false,
    
    // Scroll arrows
        $scrollDown,
        $scrollUp,
    
    // Scrolling gesture
        lastCircleGesture = null,
        
        headStyle,  // Style element for our new css
        ctl,        // Leap controller
        Vector,     // Vector class (ex-leap.js)
    
    // Setup Default Settings for Leap Motion
        leap_motion_settings = {
            'fingers': YES,
            'color': 'rainbow',
            'scrolling': ENABLED,
            'history': ENABLED
        },
    
        baseCSS = 
        
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
                'box-shadow: inset 0px 0px 1px 1px rgba(0, 0, 0, 0.25) }' +
            
            '#chrome-leap-scroll-up {' +
                'display: none; position: fixed; top:0; left:0;' +
                'width: 0; height: 0;' +
                'opacity: 0.5;' +
                'margin-left: ' + finger_size/2/2 + 'px;' +
                'border-left: ' + finger_size/2/2 + 'px solid transparent;' +
                'border-right: ' + finger_size/2/2 + 'px solid transparent;' +
                'border-bottom: ' + finger_size/2 + 'px solid ' + leap + '; }' +
            
            '#chrome-leap-scroll-down {' +
                'display: none; position: fixed; top:0; left:0;' +
                'width: 0; height: 0;' +
                'opacity: 0.5;' +
                'margin-left: ' + finger_size/2/2 + 'px;' +
                'border-left: ' + finger_size/2/2 + 'px solid transparent;' +
                'border-right: ' + finger_size/2/2 + 'px solid transparent;' +
                'border-top: ' + finger_size/2 + 'px solid ' + leap + '; }';
    
    this.init = function() {
        // Add the CSS to the page
        headStyle = document.createElement('style');
        headStyle.setAttribute('type','text/css');
        headStyle.appendChild(document.createTextNode(baseCSS));
        document.head.appendChild(headStyle);
        
        // Update Settings from Browser Extension
        update_settings();
        
        if ("storage" in chrome) {
            // called when a tab is updated (like changed away from, or refreshed, or loaded)
            chrome.storage.onChanged.addListener(update_settings);
        }
        
        addEvents();
        startLeap();
    }
    
    function addEvents() {
        // Update the width and height if the window is resized
        window.addEventListener('resize', function() {
            width = window.innerWidth;
            height = window.innerHeight;
        }, false);
        
        // Catch focus events to more quickly update the focus status
        window.addEventListener('focus', function() { tab_has_focus = true;  });
        window.addEventListener('blur' , function() { tab_has_focus = false; });
    }
    
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
    function startMonitor() {
        if(leap_motion_settings.fingers === YES) {
            add_fingers();
        }
    
        connection = requestInterval(runInterval, 1000);
    }
    
    // Single interval method to check the connection and focus status
    function runInterval() {
        if (!run) {
            // Not running, so don't check
            clearRequestInterval(connection);
            return;
        }
        
        check_connection();
        check_focus();
    }
    
    // Sometimes The Connection Dies, and Leap Motion Needs to be Restarted
    function check_connection() {
        
        now = Date.now() / 1000;
        
        // Mostly I have only had to refresh the page to make the Leap work after losing connection
        // Can probably attempt a reconnect here first
        
        if(last_poll !== null && now - last_poll > connection_lost_after) {
            
            if (retry<10) {
                retry++;
                // Attempt a reconnect
                console.log('Disconnected from Leap Motion - attempting reconnect (' + retry + '/10)');
                startLeap();
                return;
            }
            
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
                    
                    // Remove the notice after a time
                    setTimeout(function() {
                        leapDiv.parentNode.removeChild(leapDiv);
                    }, 20000);
                    
                });
            }
            catch(error) {
                console.error(error.message);
            }
        }
    }
    
    // Check if Current Tab has Focus, and only run this extension on the active tab
    function check_focus() {
        
        if (!("runtime" in chrome)) {
            // Not being run as an extension
            tab_has_focus = document.hasFocus();
            return;
        }
        
        try {
            chrome.runtime.sendMessage({ tab_status: 'current' }, function(response) {
                if(response.active && window.location.href == response.url && document.hasFocus()) {
                    tab_has_focus = true;
                }
                else {
                    tab_has_focus = false;
                }
            });
        }
        catch(error) {
            // If you clicked to reload this extension, you will get this error, which a refresh fixes
            if(error.message.indexOf('Error connecting to extension') !== -1) {
                refresh_page();
            }
            // Something else went wrong... I blame Grumpy Cat
            else {
                console.error(error.message);
            }
        }
    }
    
    // Add DOM Elements to Page to Render Fingers
    function add_fingers() {
        
        var fingerD = document.createElement('div'),
            finger = document.createElement('div'),
            thisFinger,
            cssString,
            i;
        
        fingerD.id = 'chrome-leap-fingercontainer';
        
        for(i=0; i<10; i++)
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
        
        // Create the scroll arrows
        $scrollDown = document.createElement('div'),
        $scrollUp   = document.createElement('div');
        
        $scrollDown.id = 'chrome-leap-scroll-down';
        $scrollUp.id   = 'chrome-leap-scroll-up';
        
        fingerD.appendChild($scrollDown);
        fingerD.appendChild($scrollUp);
        
        document.body.appendChild(fingerD);
        
        // Save all fingers for later
        $allFingers = document.getElementsByClassName('chrome-leap-finger');
        $scrollDown = document.getElementById('chrome-leap-scroll-down');
        $scrollUp   = document.getElementById('chrome-leap-scroll-up');
    
    }
    
    function hideFingers() {
        if(leap_motion_settings.fingers === YES) {
            
            $scrollDown.style.display = 'none';
            $scrollUp.style.display   = 'none';
            
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
    function update_fingers(scale, frame) {
        if (fingersGone) {
            // No fingers
            return;
        }
        
        hideFingers();
    
        var scaled_size = Math.ceil(finger_size * scale),
            scaled_half = Math.ceil(scaled_size / 2);
        
        if ($allFingers[0] === undefined) {
            // Fingers have been removed
            return;
        }
    
        // Make sure there are at least two fingers to render, since that is the minimum for an action
        // Also prevents forehead / face from registering as a finger during typing
        if(frame.fingers.length > 0) {
            
            var j = 0,
                fingerLen = frame.fingers.length,
                left, top;
            
            for(; j<fingerLen && j<10; j++) {
                
                if (scroll_finger!==null && scroll_finger !== frame.fingers[j].id) {
                    // if we're scrolling, keep the screen clear and only show that finger
                    continue;
                }
                
                left = ( width / 2 ) + frame.fingers[j].tipPosition[0];
                top = ( height / 2 ) - frame.fingers[j].tipPosition[1];
                
                $allFingers[j].style.top = "0";
                $allFingers[j].style.left = "0";
                $allFingers[j].style.transform = 'translate3d('+left.toFixed(2)+'px, '+top.toFixed(2)+'px, 0)';
                $allFingers[j].style.webkitTransform = 'translate3d('+left.toFixed(2)+'px, '+top.toFixed(2)+'px, 0)';
                $allFingers[j].style.opacity = 0.5;
                
                // Attach a small arrow to the scrolling finger
                if (scroll_finger === frame.fingers[j].id) {
                    if (scroll_direction==='down') {
                        $scrollDown.style.transform = 'translate3d('+left.toFixed(2)+'px, '+(top+finger_size+5)+'px, 0)';
                        $scrollDown.style.webkitTransform = 'translate3d('+left.toFixed(2)+'px, '+(top+finger_size+5)+'px, 0)';
                        $scrollDown.style.display = 'block';
                        $scrollDown.style.borderTopColor = $allFingers[j].style.backgroundColor;
                    }
                    else if (scroll_direction==='up') {
                        $scrollUp.style.transform = 'translate3d('+left.toFixed(2)+'px, '+(top-finger_size+5)+'px, 0)';
                        $scrollUp.style.webkitTransform = 'translate3d('+left.toFixed(2)+'px, '+(top-finger_size+5)+'px, 0)';
                        $scrollUp.style.display = 'block';
                        $scrollUp.style.borderBottomColor = $allFingers[j].style.backgroundColor;
                    }
                    else {
                        $scrollDown.style.display = 'none';
                        $scrollUp.style.display = 'none';
                    }
                }
                
            }
            
        }
    }
    
    // Circle Scrolling
    function scroll_page_circle(gesture, frame) {
        
        if (
               leap_motion_settings.scrolling === DISABLED
            || frame.pointablesMap === undefined
            || gesture.pointableIds.length === 0
            || frame.pointablesMap[gesture.pointableIds[0]] === undefined
            || !('direction' in frame.pointablesMap[gesture.pointableIds[0]])
        ) {
            return;
        }
        
        var vector, 
            speed = scroll_speed, 
            scroll_distance;
        
        vector              = new Vector(frame.finger(gesture.pointableIds[0]).direction);
        gesture.isClockwise = vector.angleTo(new Vector(gesture.normal))<=Math.PI/4;
        
        if (lastCircleGesture==null || gesture.isClockwise!==lastCircleGesture.isClockwise || gesture.id!==lastCircleGesture.id)
        {
            lastCircleGesture = gesture;
            return;
        }
        
        if (gesture.radius < 30) speed = speed/1.5;   // small circle - slower scroll
        if (gesture.radius > 35) speed = speed*2.5;   // big circle - faster scroll
        
        scroll_distance = (gesture.progress - lastCircleGesture.progress) * 10 * speed;
        
        // Ignore no-scroll or massive-scroll
        if (scroll_distance > 100 || scroll_distance <= 0)
        {
            lastCircleGesture = gesture;
            return;
        }
        
        clearTimeout(scroll_timeout);
        
        // Save finger in gesture for use in update_fingers
        scroll_finger = gesture.pointableIds[0];
        
        // Check direction of circle
        if ( !gesture.isClockwise )
        {        
            scroll_distance  = -scroll_distance;
            scroll_direction = 'up';
        } else {
            scroll_direction = 'down';
        }
        
        window.scrollBy(0, scroll_distance, 'smooth');
        
        // If we have finished the gesture, just reset
        lastCircleGesture = (gesture.state === 'stop') ? null : gesture;
        
        scroll_timeout = setTimeout(function() {
            scroll_direction          = null;
            scroll_finger             = null;
            $scrollDown.style.display = 'none';
            $scrollUp.style.display   = 'none';
        }, 200);
    }
    
    // Look for Hand Gestures to Navigate History
    function handle_history(gesture, frame) {
        
        if( gesture.handIds.length===0 || !donavigate || leap_motion_settings.history === DISABLED ) {
            return;
        }
        
        var translation = Math.abs(gesture.position[0] - gesture.startPosition[1]);
        
        if (translation < 100) {
            // small swipe, ignore it
            return;
        }
        
        if (gesture.direction[0] > 0) {
            history.forward();
        }
        else {
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
            startMonitor();
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
            
            startMonitor();
        });
        
    }
    
    function startLeap() {
        
        // Disconnect before connecting if something bad has happened
        if (ctl !== undefined && "connected" in ctl && ctl.connected) {
            ctl.disconnect();
            ctl = null;
        }
        
        // Connect to Leap Motion via Web Socket and Manage Actions
        ctl = new Leap.Controller({enableGestures: true});
        
        ctl.on('frame', function() {
            
            var frame = ctl.frame(0);
            
            if (!run) {
                // Switched off
                return;
            }
            
            var scale,
                now = Date.now() / 1000;
        
            last_poll = now;
            
            // Update Finger Position
            if(leap_motion_settings.fingers === 'yes' && tab_has_focus) {
                scale = (frame.hands.length > 0 && frame.hands[0]._scaleFactor !== 'undefined') ? frame.hands[0]._scaleFactor : 1;
                update_fingers(scale, frame);
            }
            else if (!fingersGone) {
                hideFingers();
            }
        
            // If nothing is happening, reset interaction
            if (frame.pointables === undefined || !tab_has_focus) {
                action = null;
                return;
            }
        
            // Look for Swipe Gesture
            if (frame.gestures && frame.gestures.length > 0) {
                action = 'gesture';
            }
            // Nothing is happening, reset actions
            else {
                action = null;
            }
        
            if(action!==null) {
                
                switch(action) {
                        
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
                            handle_history(gesture, frame);
                            break;
                        }
                        
                        break;
                }
            }
        
            if (frame !== undefined && frame.pointables !== undefined && frame.pointables.length > 0) {
                last_frame = frame;
                last_action = action;
            }
        
        });
        
        ctl.connect();
    }
    
    // Stripped down Vector class from older version of leapjs library
    // (https://github.com/leapmotion/leapjs/commit/acda94854310e28af0c02432f3b1906aa242c616)
    function Vector(data){
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
}).apply(leapMotionChromeExtension);

// Kick it off
leapMotionChromeExtension.init();
