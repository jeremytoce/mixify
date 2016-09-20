const express = require('express');
const request = require('request');
const bodyParser = require('body-parser');
const path = require('path');
const cors = require('cors');
var rp = require('request-promise');
const querystring = require('querystring');
const cookieParser = require('cookie-parser');

const app = express();

var client_id = 'dcb2d91d22e743709cb99bfe2cd41f95'; // Your client id
var client_secret = '11afa82900c54549ab30c24eea3adb91'; // Your secret
var redirect_uri = 'http://localhost:3000/callback'; // Your redirect uri
var spotifyID;
var access_token;

// Enable all CORS Requests
app.use(cors());

// Use a body parser
app.use(bodyParser.urlencoded({extended:true}));

// BodyParser JSON setup
 app.use(bodyParser.json());

// Serve static files
app.use(express.static(path.join(__dirname, 'client')))
	.use(cookieParser());


// Shuffle function - shuffles the final mixtape result to provide unique, non-repeating lists
// refactor to other page

function shuffle(array) {
  var currentIndex = array.length, temporaryValue, randomIndex;
  while (0 !== currentIndex) {
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex -= 1;
    temporaryValue = array[currentIndex];
    array[currentIndex] = array[randomIndex];
    array[randomIndex] = temporaryValue;
  }
  return array;
}

const requestPromise = function(options) {
	return new Promise((resolve, reject) => {
		request(options, (err, response, body) => {
			if (err) {
				reject(err);
			} else {
				resolve(body);
			}
		})
	})
}


///////////////////////////////////////////
/////// SPOTIFY AUTHENTICATION FLOW ///////
///////////////////////////////////////////

/**
 * Generates a random string containing numbers and letters
 * @param  {number} length The length of the string
 * @return {string} The generated string
 */
var generateRandomString = function(length) {
  var text = '';
  var possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

  for (var i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
};

var stateKey = 'spotify_auth_state';

// var app = express();

// app.use(express.static(__dirname + '/public'))
   // .use(cookieParser());

app.get('/login', function(req, res) {

  var state = generateRandomString(16);
  res.cookie(stateKey, state);

  // your application requests authorization
  var scope = 'user-read-private user-read-email playlist-read-private playlist-read-collaborative playlist-modify-public playlist-modify-private';
  res.redirect('https://accounts.spotify.com/authorize?' +
    querystring.stringify({
      response_type: 'code',
      client_id: client_id,
      scope: scope,
      redirect_uri: redirect_uri,
      state: state
    }));
});

app.get('/callback', function(req, res) {

  // your application requests refresh and access tokens
  // after checking the state parameter

  var code = req.query.code || null;
  var state = req.query.state || null;
  var storedState = req.cookies ? req.cookies[stateKey] : null;

  if (state === null || state !== storedState) {
    res.redirect('/#' +
      querystring.stringify({
        error: 'state_mismatch'
      }));
  } else {
    res.clearCookie(stateKey);
    var authOptions = {
      url: 'https://accounts.spotify.com/api/token',
      form: {
        code: code,
        redirect_uri: redirect_uri,
        grant_type: 'authorization_code'
      },
      headers: {
        'Authorization': 'Basic ' + (new Buffer(client_id + ':' + client_secret).toString('base64'))
      },
      json: true
    };

    request.post(authOptions, function(error, response, body) {
      if (!error && response.statusCode === 200) {

        access_token = body.access_token,
        refresh_token = body.refresh_token;

        var options = {
          url: 'https://api.spotify.com/v1/me',
          headers: { 'Authorization': 'Bearer ' + access_token },
          json: true
        };

        // use the access token to access the Spotify Web API
        request.get(options, function(error, response, body) {
          // console.log(body);
          spotifyID = body.id;
        });

        // we can also pass the token to the browser to make requests from there
        res.redirect('/#' +
          querystring.stringify({
            access_token: access_token,
            refresh_token: refresh_token
          }));
      } else {
        res.redirect('/#' +
          querystring.stringify({
            error: 'invalid_token'
          }));
      }
    });
  }
});

app.get('/refresh_token', function(req, res) {

  // requesting access token from refresh token
  var refresh_token = req.query.refresh_token;
  var authOptions = {
    url: 'https://accounts.spotify.com/api/token',
    headers: { 'Authorization': 'Basic ' + (new Buffer(client_id + ':' + client_secret).toString('base64')) },
    form: {
      grant_type: 'refresh_token',
      refresh_token: refresh_token
    },
    json: true
  };

  request.post(authOptions, function(error, response, body) {
    if (!error && response.statusCode === 200) {
      var access_token = body.access_token;
      res.send({
        'access_token': access_token
      });
    }
  });
});


///////////////////////////////////////////
///////////// REQUEST ENDPOINT ////////////
///////////////////////////////////////////

// Returns the name and ID of user-entered artists

app.post('/request', function(req, res){
  const artist = req.body.artist;
  const searchURL = "https://api.spotify.com/v1/search?q="+artist+"&type=artist&limit=3";

  requestPromise(searchURL)
  .then(function(data) {
  		const artistBody = JSON.parse(data);
  		const artistInfo = artistBody.artists.items[0];
  		const sendObj = {
  			name: artistInfo.name,
  			image: artistInfo.images[0].url,
  			genre: artistInfo.genres[0]
  		}
      res.end(JSON.stringify(sendObj));
  }, function(err) {
      res.end("N/A");
  })
});


///////////////////////////////////////////
///////////// MIXTAPE ENDPOINT ////////////
///////////////////////////////////////////

app.post('/mixify', function(req, res) {

  	const favoriteArtists = JSON.parse(req.body.favoriteArtists);
  	var relatedArtists = [];
  	var playlistID;
  	var favoriteArtistURLs = [];
	var uriArray = [];
	var relatedSongsArray = [];
	var songIDArray = [];
	var postToPlaylistMaster;


	var createPlaylist = {
		method: 'POST',
		url: 'https://api.spotify.com/v1/users/mixifytest/playlists',
		headers: {'Authorization': 'Bearer ' + access_token, 'Accept': 'application/json'},
		json: true,
		body: {
  			"name": "Mixify Playlist",
  			"public": false
		}		
	}

	function makeSearchUrl(artist) {
	  return "https://api.spotify.com/v1/search?q="+artist+"&type=artist"
	}

	function makeRelatedArtistUrl(uri) {
		var parsedUri = uri.replace("spotify:artist:", "")
		return "https://api.spotify.com/v1/artists/"+parsedUri+"/related-artists"
	}

	function makeRelatedSongsUrl(relatedArtist) {
		return "https://api.spotify.com/v1/artists/"+relatedArtist+"/top-tracks?country=US"
	}

	function parsePlaylistUri(uri) {
		var parsedPlaylistUri = uri.replace("spotify:user:mixifytest:playlist:", "");
		return parsedPlaylistUri;
	}



	requestPromise(createPlaylist)
	  .then(function(data) {
	  	playlistID = parsePlaylistUri(data.uri);
	    return Promise.all(favoriteArtists.map(function (artist) {
	      return requestPromise(makeSearchUrl(artist))
	    }))
	  })
	  .then(function(results) {
	    return Promise.all(results.map(function (result) {
	    	var parseResult = JSON.parse(result);
	    	return parseResult.artists.items[0].uri;
	    }))
	  })
	  .then(function(uris) {
	  	return Promise.all(uris.map(function(uri) {
	  		return requestPromise(makeRelatedArtistUrl(uri))
	  	}))
	  })
	  .then(function(relatedArtists) {
	  	return Promise.all(relatedArtists.map(function(artist) {
	  		var parseArtist = JSON.parse(artist);
	  		for (var i = 0; i < 5; i++) {
	  			relatedSongsArray.push(makeRelatedSongsUrl(parseArtist.artists[i].id))
	  		}
	  	}))
	  })
	  .then(function(topTracks) {
	  	return Promise.all(relatedSongsArray.map(function(relatedSongURL) {
	  		return requestPromise(relatedSongURL);
	  	}))
	  })
	  .then(function(allSongs) {
	  	for (var i = 0; i < allSongs.length; i++) {
	  		allSongsParsed = JSON.parse(allSongs[i]);
	  		songIDArray.push(allSongsParsed.tracks[0].uri)
	  		songIDArray.push(allSongsParsed.tracks[1].uri)
	  		songIDArray.push(allSongsParsed.tracks[2].uri)
	  	}
	  })
	  .then(function() {
	  		shuffle(songIDArray);
	  		return songIDArray.splice(19);
	  })
	  .then(function(tracks) {
	  	var postToPlaylist = 'https://api.spotify.com/v1/users/mixifytest/playlists/'+playlistID+'/tracks?uris=';
	  	for (var i = 0; i < songIDArray.length; i++) {
	  		postToPlaylist = postToPlaylist + songIDArray[i] + ',';
	  	}
	  	return postToPlaylistMaster = postToPlaylist.slice(0, -1);
	  })
	  .then(function(postURL) {
	  	var addToPlaylist = {
	  		method: 'POST',
	  		url: postToPlaylistMaster,
	  		headers: {'Authorization': 'Bearer ' + access_token, 'Accept': 'application/json'},
	  		json: true
	  	}
	  	requestPromise(addToPlaylist);
	  	res.end(playlistID);
	  })
	  .catch(function(error) {
	    console.log(error)
	    throw error
	  });
	})

app.listen(3000, function () {
  console.log('App listening on port 3000');
});