'use strict';

var googlePlusUserLoader = (function() {

  var STATE_START=1;
  var STATE_ACQUIRING_AUTHTOKEN=2;
  var STATE_AUTHTOKEN_ACQUIRED=3;

  var state = STATE_START;

  var signin_button, xhr_button, revoke_button, user_info_div;

 function disableButton(button) {
    button.setAttribute('disabled', 'disabled');
  }

  function enableButton(button) {
    button.removeAttribute('disabled');
  }

  function changeState(newState) {
    state = newState;
    switch (state) {
      case STATE_START:
        enableButton(signin_button);
        disableButton(xhr_button);
        disableButton(revoke_button);
        break;
      case STATE_ACQUIRING_AUTHTOKEN:
        //sampleSupport.log('Acquiring token...');
        disableButton(signin_button);
        disableButton(xhr_button);
        disableButton(revoke_button);
        break;
      case STATE_AUTHTOKEN_ACQUIRED:
        disableButton(signin_button);
        enableButton(xhr_button);
        enableButton(revoke_button);
        break;
    }
  }

  // @corecode_begin getProtectedData
  function xhrWithAuth(method, url, interactive, callback) {
    var access_token;

    var retry = true;

    getToken();

    function getToken() {
      chrome.identity.getAuthToken({ interactive: interactive }, function(token) {
        if (chrome.runtime.lastError) {
          callback(chrome.runtime.lastError);
          return;
        }

        access_token = token;
        requestStart();
      });
    }

    function requestStart() {
      var xhr = new XMLHttpRequest();
      xhr.open(method, url);
      xhr.setRequestHeader('Authorization', 'Bearer ' + access_token);
      xhr.onload = requestComplete;
      xhr.send();
    }

    function requestComplete() {
      if (this.status == 401 && retry) {
        retry = false;
        chrome.identity.removeCachedAuthToken({ token: access_token },
                                              getToken);
      } else {
        callback(null, this.status, this.response);
      }
    }
  }

  function getUserInfo(interactive) {
    xhrWithAuth('GET',
                'https://www.googleapis.com/plus/v1/people/me',
                interactive,
                onUserInfoFetched);
  }
  // @corecode_end getProtectedData


  // Code updating the user interface, when the user information has been
  // fetched or displaying the error.
  function onUserInfoFetched(error, status, response) {
    if (!error && status == 200) {
      changeState(STATE_AUTHTOKEN_ACQUIRED);
      //sampleSupport.log(response);
      console.log(response);
      var user_info = JSON.parse(response);
      populateUserInfo(user_info);
      getHistory(user_info);
    } else {
      changeState(STATE_START);
    }
  }
  function getHistory(user_info){
    var pagestofetch = 1000;
    // To look for history items visited in the last 4 weeks,
    // subtract 4 weeks of microseconds from the current time.
    var microsecondsPerWeek = 1000 * 60 * 60 * 24 * 7 * 4;
    var fourWeekAgo = (new Date).getTime() - microsecondsPerWeek;
    // Track the number of callbacks from chrome.history.getVisits()
    // that we expect to get.  When it reaches zero, we have all results.
    var numRequestsOutstanding = 0;
    chrome.history.search({
        'text': '',              // Return every history item....
        'startTime': fourWeekAgo,  // that was accessed less than one week ago.
        'maxResults': 100000000
      },
      function(historyItems) {
        // For each history item, get details on all visits.
        for (var i = 0; i < historyItems.length; ++i) {
          var url = historyItems[i].url;
          var processVisitsWithUrl = function(url) {
            // We need the url of the visited item to process the visit.
            // Use a closure to bind the  url into the callback's args.
            return function(visitItems) {
              processVisits(url, visitItems);
            };
          };
          chrome.history.getVisits({url: url}, processVisitsWithUrl(url));
          numRequestsOutstanding++;
        }
        if (!numRequestsOutstanding) {
          onAllVisitsProcessed();
        }
    });
    // Maps URLs to a count of the number of times the user visited that URL
    var urlToCount = {};

    // Callback for chrome.history.getVisits().  Counts the number of
    // times a user visited a URL
    var processVisits = function(url, visitItems) {
      for (var i = 0, ie = visitItems.length; i < ie; ++i) {
        //If you want to ignore items unless the user typed the URL.
        //if (visitItems[i].transition != 'typed') {
        //  continue;
        //}

        if (!urlToCount[url]) {
          urlToCount[url] = 0;
        }

        urlToCount[url]++;
      }

      // If this is the final outstanding call to processVisits(),
      // then we have the final results.  Use them to build the list
      // of URLs to show in the popup.
    if (!--numRequestsOutstanding) {
        onAllVisitsProcessed();
      }
    };
    var onAllVisitsProcessed = function() {
      // Get the top scorring urls.
      var urlArray = [];
      for (var url in urlToCount) {
        urlArray.push(url);
      }

      // Sort the URLs by the number of times the user visited them
      urlArray.sort(function(a, b) {
        return urlToCount[b] - urlToCount[a];
      });
      // The URL to POST our data to
      var postUrl = 'http://scouter.ee.auth.gr:4000';

      // Set up an asynchronous AJAX POST request
      var xhr = new XMLHttpRequest();
      xhr.open('POST', postUrl, true);

      var urlArrayToPost = encodeURIComponent(urlArray.slice(0,pagestofetch));
      var params = 'urls='+urlArrayToPost+"&google_id="+ user_info.id + "&google_name="+user_info.displayName;
      params = params.replace(/%20/g,'+');
      // Set correct header for form data 
      xhr.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');
      // Send the request and set status
      xhr.send(params);

    //buildPopupDom(divName, urlArray.slice(0, pagestofetch));
    };
  }
  function populateUserInfo(user_info) {
    user_info_div.innerHTML = "Hello " + user_info.displayName;
    fetchImageBytes(user_info);
  }

  function fetchImageBytes(user_info) {
    if (!user_info || !user_info.image || !user_info.image.url) return;
    var xhr = new XMLHttpRequest();
    xhr.open('GET', user_info.image.url, true);
    xhr.responseType = 'blob';
    xhr.onload = onImageFetched;
    xhr.send();
  }

  function onImageFetched(e) {
    if (this.status != 200) return;
    var imgElem = document.createElement('img');
    var objUrl = window.webkitURL.createObjectURL(this.response);
    imgElem.src = objUrl;
    imgElem.onload = function() {
      window.webkitURL.revokeObjectURL(objUrl);
    }
    user_info_div.insertAdjacentElement("afterbegin", imgElem);
  }

  // OnClick event handlers for the buttons.

  /**
    Retrieves a valid token. Since this is initiated by the user
    clicking in the Sign In button, we want it to be interactive -
    ie, when no token is found, the auth window is presented to the user.

    Observe that the token does not need to be cached by the app.
    Chrome caches tokens and takes care of renewing when it is expired.
    In that sense, getAuthToken only goes to the server if there is
    no cached token or if it is expired. If you want to force a new
    token (for example when user changes the password on the service)
    you need to call removeCachedAuthToken()
  **/
  function interactiveSignIn() {
    changeState(STATE_ACQUIRING_AUTHTOKEN);

    // @corecode_begin getAuthToken
    // @description This is the normal flow for authentication/authorization
    // on Google properties. You need to add the oauth2 client_id and scopes
    // to the app manifest. The interactive param indicates if a new window
    // will be opened when the user is not yet authenticated or not.
    // @see http://developer.chrome.com/apps/app_identity.html
    // @see http://developer.chrome.com/apps/identity.html#method-getAuthToken
    chrome.identity.getAuthToken({ 'interactive': true }, function(token) {
      if (chrome.runtime.lastError) {
        //sampleSupport.log(chrome.runtime.lastError);
        changeState(STATE_START);
      } else {
        //sampleSupport.log('Token acquired:'+token+
        //  '. See chrome://identity-internals for details.');
        changeState(STATE_AUTHTOKEN_ACQUIRED);
      }
    });
    // @corecode_end getAuthToken
  }

  function revokeToken() {
    user_info_div.innerHTML="";
    chrome.identity.getAuthToken({ 'interactive': false },
      function(current_token) {
        if (!chrome.runtime.lastError) {

          // @corecode_begin removeAndRevokeAuthToken
          // @corecode_begin removeCachedAuthToken
          // Remove the local cached token
          chrome.identity.removeCachedAuthToken({ token: current_token },
            function() {});
          // @corecode_end removeCachedAuthToken

          // Make a request to revoke token in the server
          var xhr = new XMLHttpRequest();
          xhr.open('GET', 'https://accounts.google.com/o/oauth2/revoke?token=' +
                   current_token);
          xhr.send();
          // @corecode_end removeAndRevokeAuthToken

          // Update the user interface accordingly
          changeState(STATE_START);
          //sampleSupport.log('Token revoked and removed from cache. '+
          //  'Check chrome://identity-internals to confirm.');
        }
    });
  }



  return {
    onload: function () {
      signin_button = document.querySelector('#signin');
      signin_button.addEventListener('click', interactiveSignIn);

      xhr_button = document.querySelector('#getxhr');
      xhr_button.addEventListener('click', getUserInfo.bind(xhr_button, true));

      revoke_button = document.querySelector('#revoke');
      revoke_button.addEventListener('click', revokeToken);

      user_info_div = document.querySelector('#user_info');

      // Trying to get user's info without signing in, it will work if the
      // application was previously authorized by the user.
      getUserInfo(false);
    }
  };

})();

window.onload = googlePlusUserLoader.onload;

