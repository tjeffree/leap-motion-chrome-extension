// Saves options to localStorage.
function save_options()
{
	chrome.storage.local.set({
		'leap_motion_fingers': jQuery('#fingers').val(),
		'leap_motion_color': jQuery('#color').val(),
		'leap_motion_scrolling': jQuery('#scrolling').val(),
		'leap_motion_history': jQuery('#history').val(),
		'leap_motion_zoom': jQuery('#zoom').val(),
		'leap_motion_rotation': jQuery('#rotation').val()
	});

	// Update status to let user know options were saved.
	$('#status').html('Options Saved').fadeIn();

	setTimeout(function(){ $('#status').fadeOut(); }, 3000);
}

// Reset options to default in localStorage.
function reset_options()
{
	chrome.storage.local.set({
		'leap_motion_fingers': 'yes',
		'leap_motion_color': 'rainbow',
		'leap_motion_scrolling': 'enabled',
		'leap_motion_history': 'enabled',
		'leap_motion_zoom': 'disabled',
		'leap_motion_rotation': 'disabled'
	});

	jQuery('#fingers').val('yes');
	jQuery('#color').val('rainbow');
	jQuery('#scrolling').val('enabled');
	jQuery('#history').val('enabled');
	jQuery('#zoom').val('disabled');
	jQuery('#rotation').val('disabled');

	// Update status to let user know options were saved.
	$('#status').html('Options Reset').fadeIn();

	setTimeout(function(){ $('#status').fadeOut(); }, 3000);
}

// Restores select box state to saved value from localStorage.
function restore_options()
{
	// Setup Defaults and check for chosen settings
	var leap_motion_settings = {
		'fingers': 'yes',
		'color': 'rainbow',
		'scrolling': 'enabled',
		'history': 'enabled',
		'zoom': 'disabled',
		'rotation': 'disabled'
	};

	// Fetch Leap Motion Settings for Fingers
	chrome.storage.local.get('leap_motion_fingers', function(fetchedData) {
		if(typeof fetchedData.leap_motion_fingers !== 'undefined')
		{
			leap_motion_settings.fingers = fetchedData.leap_motion_fingers;
		}

		jQuery('#fingers').val(leap_motion_settings.fingers);
	});

	// Fetch Leap Motion Settings for Color
	chrome.storage.local.get('leap_motion_color', function(fetchedData) {
		if(typeof fetchedData.leap_motion_color !== 'undefined')
		{
			leap_motion_settings.color = fetchedData.leap_motion_color;
		}

		jQuery('#color').val(leap_motion_settings.color);
	});

	// Fetch Leap Motion Settings for Scrolling
	chrome.storage.local.get('leap_motion_scrolling', function(fetchedData) {
		if(typeof fetchedData.leap_motion_scrolling !== 'undefined')
		{
			leap_motion_settings.scrolling = fetchedData.leap_motion_scrolling;
		}

		jQuery('#scrolling').val(leap_motion_settings.scrolling);
	});

	// Fetch Leap Motion Settings for History
	chrome.storage.local.get('leap_motion_history', function(fetchedData) {
		if(typeof fetchedData.leap_motion_history !== 'undefined')
		{
			leap_motion_settings.history = fetchedData.leap_motion_history;
		}

		jQuery('#history').val(leap_motion_settings.history);
	});

	// Fetch Leap Motion Settings for Zoom
	chrome.storage.local.get('leap_motion_zoom', function(fetchedData) {
		if(typeof fetchedData.leap_motion_zoom !== 'undefined')
		{
			leap_motion_settings.zoom = fetchedData.leap_motion_zoom;
		}

		jQuery('#zoom').val(leap_motion_settings.zoom);
	});

	// Fetch Leap Motion Settings for Rotation
	chrome.storage.local.get('leap_motion_rotation', function(fetchedData) {
		if(typeof fetchedData.leap_motion_rotation !== 'undefined')
		{
			leap_motion_settings.rotation = fetchedData.leap_motion_rotation;
		}

		jQuery('#rotation').val(leap_motion_settings.rotation);
	});
}

document.addEventListener('DOMContentLoaded', restore_options);
document.querySelector('#save').addEventListener('click', save_options);
document.querySelector('#reset').addEventListener('click', reset_options);
