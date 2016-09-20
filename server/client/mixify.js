$(document).ready(function() {

	var scopes = 'user-read-private user-read-email';
	var currentArtist = {};
	var favoriteArtists = [];
	var listFillers = [{name: 't1', image: 'avatar1', genre: 'genre1'}, {name: 't2', image: 'avatar2', genre: 'genre2'}, {name: 't3', image: 'avatar3', genre: 'genre3'}, {name: 't4', image: 'avatar4', genre: 'genre4'}];
	var playlistID;

	var artistSearch = () => {
		if (favoriteArtists.length < 5) {

			if ($('.artistName').val() === '') {
				Materialize.toast('Input cannot be empty.', 2000, 'rounded')
				return;
			}

			const q = $('.artistName').val();

			$.ajax({
			  	type: "POST",
			  	url: "http://localhost:3000/request",
			  	data: {artist: q},
			})
			.done(function(data) {
				if (data === 'N/A') {
					Materialize.toast('Artist not found!', 2000, 'rounded')
				}

				var parsedData = JSON.parse(data);
				  	console.log('data: ', parsedData.name);
				  	currentArtist = {
				  		name: parsedData.name,
				  		image: parsedData.image,
				  		genre: parsedData.genre
				  	}
				  	$(".artistName").empty();
				  	$(".artistName").append(parsedData.name);
				  	$(".artistImage").attr("src", parsedData.image);
				  	console.log(favoriteArtists);

				});
		}
	};

	var addToFavorites = () => {
		console.log(currentArtist.image)
		favoriteArtists.push(currentArtist.name);
		var position = listFillers[favoriteArtists.length-1];
		console.log(currentArtist)
		$("." + position.name).empty();
		$("." + position.name).append(currentArtist.name);
		$("." + position.genre).empty();
		$("." + position.genre).append(currentArtist.genre);
		$("." + position.image).attr("src", currentArtist.image);
		Materialize.toast('Artist added to favorites', 2000, 'rounded');

	}

	var mixify = () => {
		console.log(favoriteArtists)
		const q = JSON.stringify(favoriteArtists);
		$(".rightSide").empty();
		$(".rightSide").append('<div class="preloader-wrapper big active" style="margin-top: 50%"><div class="spinner-layer spinner-green-only"><div class="circle-clipper left"><div class="circle"></div></div><div class="gap-patch"><div class="circle"></div></div><div class="circle-clipper right"><div class="circle"></div></div></div></div>')
		      
		$.ajax({
		  	type: "POST",
		  	url: "http://localhost:3000/mixify",
		  	data: {favoriteArtists: q},
		})
		.done(function(data) {
			playlistID = data;
			$(".rightSide").empty();
			$(".rightSide").append('<iframe style="padding-top: 20px;" src="https://embed.spotify.com/?uri=spotify:user:mixifytest:playlist:'+playlistID+'" width="600" height="650" frameborder="0" allowtransparency="true"></iframe>')

		});
	}


	$(".artistSearch").submit( (e) => {
		e.preventDefault();
		artistSearch();


	});

	$(".mixify").click( () => {
		mixify();

	});

	$(".addToFavorites").click( () => {
			addToFavorites();
	});





});
