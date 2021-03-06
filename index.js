#!/usr/bin/env node
'use strict';
const SpotifyWebApi = require('spotify-web-api-node');
const fs = require('fs');
const got = require('got');
const meow = require('meow');
const chalk = require('chalk');
const ora = require('ora');
const spinner = ora('Loading ...');

const singlespotify = async function singlespotify(inputs, flags) {

	// ora loading spinner
	spinner.start();

	// -a "Kanye West"
	const artistName = flags['a'];

	// -a "" evaluates to true due to minimist
	if (artistName === true){
		spinner.fail('Failed');
		console.log(chalk.red(`
	Oops! That search didn't work. Try again please!
	`))
		return
	}

	// -c path/to/config.json
	const configFile = flags['c'];

	// get bearer token from path to config file
	try {
		var configJSON = JSON.parse(require('fs').readFileSync(configFile, 'utf8'));
	}
	catch(err) {
		spinner.fail('Failed');
		console.log(chalk.red(`
	Oops! That wasn't a valid config path. Try again please!

	See https://github.com/kabirvirji/singlespotify#usage for more information
	`))
		return
	}

	var tracks = [];
	var artists = [];

	const spotifyApi = new SpotifyWebApi();

	// get artist URI
	const artistSearch = await spotifyApi.searchArtists(artistName);
	// error check for invalid search
	if (artistSearch.body.artists.items[0] === undefined) {
		spinner.fail('Failed');
		console.log(chalk.red(`

	Oops! That search didn't work. Try again please!
	`))
		return
	}
	let artistURI = artistSearch.body.artists.items[0].uri;
	artistURI = artistURI.slice(15);

	// get artist top tracks
	let artistTopTracks = await spotifyApi.getArtistTopTracks(artistURI, 'CA');
	artistTopTracks = artistTopTracks.body.tracks;
	for (let artistTrack of artistTopTracks) {
		tracks.push(artistTrack.uri);
	}

	// get three related artists
	let relatedArtists = await spotifyApi.getArtistRelatedArtists(artistURI);
	relatedArtists = relatedArtists.body.artists;
	for (var i=0;i<3;i++){
		var currentArtist = relatedArtists[i].uri;
		artists.push(currentArtist.slice(15));
	}

	// add related artists top songs to tracks array
	let artistOne = await spotifyApi.getArtistTopTracks(artists[0], 'CA');
	artistOne = artistOne.body.tracks;
	for (var i=0;i<3;i++){
		tracks.push(artistOne[i].uri);
	}
	let artistTwo = await spotifyApi.getArtistTopTracks(artists[1], 'CA');
	artistTwo = artistTwo.body.tracks;
	for (var i=0;i<3;i++){
		tracks.push(artistTwo[i].uri);
	}
	let artistThree = await spotifyApi.getArtistTopTracks(artists[2], 'CA');
	artistThree = artistThree.body.tracks;
	for (var i=0;i<3;i++){
		tracks.push(artistThree[i].uri);
	}

	// create an empty public playlist
	var options = {
	  json: true, 
	  headers: {
	    'Content-type': 'application/json',
	    'Authorization' : `Bearer ${configJSON.bearer}`,
	    'Accept' : 'application/json'
	  },
	  body: JSON.stringify({ name: `${artistName}: singlespotify`, public : true})
	};

	got.post(`https://api.spotify.com/v1/users/${configJSON.username}/playlists`, options)
	  .then(response => {
	    const playlistID = response.body.id;

			// function to add tracks to playlist
			function populatePlaylist (id, uris) {
				var url = `https://api.spotify.com/v1/users/${configJSON.username}/playlists/${id}/tracks?uris=${uris}`
				var options = {
				  json: true, 
				  headers: {
				    'Content-type': 'application/json',
				    'Authorization' : `Bearer ${configJSON.bearer}`,
				  }
				};
				got.post(url, options)
				  .then(response => {
				  	spinner.succeed('Success!');
				    console.log(chalk.green(`
	Your playlist is ready! 
	It's called "${artistName}: singlespotify"`));
				  })
				  .catch(err => { 
				  	spinner.fail('Failed');
				  	console.log(chalk.red("There was an error adding songs to the playlist. Please try again.")); 
				  });
			}

			populatePlaylist(playlistID, tracks);

	  })

	  .catch(err => { spinner.fail('Failed');
	  	console.log(chalk.red(`
	ERROR: Please update your bearer token in your config.json

	Generate a new one at https://developer.spotify.com/web-api/console/post-playlists/`));

	  });

}

spinner.stop();

const cli = meow(chalk.cyan(`
    Usage
      $ singlespotify --artist [-a] "artist_name" --config [-c] /path/to/config.json

    Example
      $ singlespotify -a "Kanye West" -c /Users/kabirvirji/config.json

    For more information visit https://github.com/kabirvirji/singlespotify

`), {
    alias: {
        a: 'artist',
        c: 'config'
    }
}, [""]
);

singlespotify(cli.input[0], cli.flags);
