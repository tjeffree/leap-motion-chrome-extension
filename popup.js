window.onload = function(){
	var opts = chrome.extension.getURL('options.html');
	var link = document.getElementById('opts_link');
	link.setAttribute('href', opts);
};
