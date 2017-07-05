'use strict';

const fs = require('fs'),
	  http = require('http'),
	  nodeID3 = require('node-id3'),
	  Deezer = require("node-deezer-api"),
	  Telegraf = require('telegraf');
const token = process.argv[2];
const bot = new Telegraf(`${token}`);

const { Extra, Markup } = require('telegraf');

function fixName(input,file){
	let specialCharTable = ["ç", "Ç", "ğ", "Ğ", "ı", "I", "i", "İ", "ş", "Ş"];
	let specialCharTo = ["c", "C", "g", "G", "i", "I", "i", "I", "s", "S"];
	let regEx = new RegExp('[,/\\\\:*?""<>|]', 'g');
    if(!file) {
      regEx = new RegExp('[/\\\\""<>|]', 'g');
    }
    let fixedName = input.replace(regEx, '_');
    for(let i = 0; i < specialCharTable.length; i++) {
      regEx = new RegExp(specialCharTable[i], 'g');
      fixedName = fixedName.replace(regEx, specialCharTo[i]);
    }
    while(fixedName && fixedName.slice(-1) === ".") { 
      fixedName = fixedName.slice(0, -1);
    }
    return fixedName;
};
bot.command('start', (ctx) => {
  console.log('start', ctx.from)
  ctx.reply('Bienvenidos!')
})
bot.hears(/\/search (.+)/, (ctx) => {

	Deezer.then(dz => {
		let deezer = dz;
		let search = ctx.match[1];
        
        deezer.search(search,'track').then(resp => { 
          	let items = resp.data.length;
        
          	for (let i = 0; i < items; i++ ){
          		ctx.reply(`Titulo: ${resp.data[i].title}\nArtista: ${resp.data[i].artist.name}\nAlbum: ${resp.data[i].album.title}`,
          			Markup.inlineKeyboard([
				      Markup.callbackButton('Descargar', `${resp.data[i].id}`),
				    ]).extra()
          		);
          		console.log(`Titulo: ${resp.data[i].title}`);
          	}
        });
    }).catch(err => console.log(err));

})
bot.action(/.+/, (ctx, next) => {
	
	Deezer.then(dz => {
		let deezer = dz;
		let trackId = ctx.match[0];

		deezer.getTrack(trackId).then(track => {

			let metadata = {
					title: fixName(track['SNG_TITLE']),			
					artist: fixName(track["ART_NAME"]),
        			album: track["ALB_TITLE"]
			};
			let duration = track["DURATION"];
			ctx.answerCallbackQuery(`Descargando: ${metadata.title} 👍`);

			if(track["ALB_PICTURE"]) {
		    	metadata.image = deezer.albumPicturesHost + track["ALB_PICTURE"] + deezer.albumPictures.big;
		    }
		    if(metadata.image) {
		    	let imagefile = fs.createWriteStream(__dirname + "/img/" + fixName(metadata.title, true) + ".jpg");
		        http.get(metadata.image, function(response) {
		          if(!response) {
		            metadata.image = undefined;
		            return;
		          }
		          response.pipe(imagefile);
		          metadata.image = (__dirname + '/img/' + fixName(metadata.title, true) + ".jpg").replace(/\\/g, "/");
		        });
		    }
			deezer.decryptTrack(track).then(buffer => {
				
				let fileName = `${metadata.artist} - ${metadata.title}`;
				let filePath = __dirname+`/${fileName}`;
		        //console.log(filePath);
		        fs.writeFile(`${fileName}.mp3`,buffer, function(err){
		        	console.log(metadata);
		        	nodeID3.write(metadata, `${filePath}.mp3`);
		        	console.log(`Descargando ${fileName}`);
		        	console.log(`${filePath}.mp3`);
		        	return ctx.replyWithAudio({
		        		source: `${filePath}.mp3`
		        	},{
		        		duration: duration,
		        		title: metadata.title,
		        		performer: metadata.artist
		        	});
		        });
		    }).catch(err => console.log(err));

		}).catch(err => console.log(err));
	});
});
bot.startPolling();
