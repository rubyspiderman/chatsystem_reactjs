//========================== install vector-im client 

####
On ubuntu:
curl https://raw.githubusercontent.com/creationix/nvm/v0.25.0/install.sh | bash
source ~/.bashrc 
nvm install 4.1.1
####
On windows:
download https://nodejs.org/en/blog/release/v4.1.1/
specifically:
https://nodejs.org/dist/v4.1.1/node-v4.1.1-x64.msi
###
Build instructions for Windows (easily adaptable to ubuntu):
C:\Users\Joseph>git clone https://joseph_heenan@bitbucket.org/greenkeytech/vector-web.git
C:\Users\Joseph>cd vector-web
C:\Users\Joseph\vector-web>git clone https://joseph_heenan@bitbucket.org/greenkeytech/matrix-js-sdk.git
C:\Users\Joseph\vector-web>cd matrix-js-sdk
C:\Users\Joseph\vector-web\matrix-js-sdk>npm install
C:\Users\Joseph\vector-web\matrix-js-sdk>npm install source-map-loader
C:\Users\Joseph\vector-web\matrix-js-sdk>cd ..
C:\Users\Joseph\vector-web>git clone https://joseph_heenan@bitbucket.org/greenkeytech/matrix-react-sdk.git
C:\Users\Joseph\vector-web>cd matrix-react-sdk
C:\Users\Joseph\vector-web\matrix-react-sdk>npm link ..\matrix-js-sdk
C:\Users\Joseph\vector-web\matrix-react-sdk>npm install
C:\Users\Joseph\vector-web\matrix-react-sdk>cd ..
C:\Users\Joseph\vector-web>npm install -g catw
C:\Users\Joseph\vector-web>npm install
C:\Users\Joseph\vector-web>del vector\fonts
C:\Users\Joseph\vector-web>del vector\img
C:\Users\Joseph\vector-web>mkdir vector\fonts
C:\Users\Joseph\vector-web>mkdir vector\img
C:\Users\Joseph\vector-web>xcopy /E C:\Users\Joseph\vector-web\src\skins\vector\fonts C:\Users\Joseph\vector-web\vector\fonts
C:\Users\Joseph\vector-web>xcopy /E C:\Users\Joseph\vector-web\src\skins\vector\img C:\Users\Joseph\vector-web\vector\img
C:\Users\Joseph\vector-web>npm start
> vector-web@0.1.2 start C:\Users\Joseph\vector-web
> parallelshell "npm run start:js" "npm run start:skins:css" "http-server -c 1 vector"
Starting up http-server, serving vector
Available on:
http:192.168.56.1:8080
http:192.168.1.82:8080
http:127.0.0.1:8080
Hit CTRL-C to stop the server
> vector-web@0.1.2 start:js C:\Users\Joseph\vector-web
> webpack -w src/vector/index.js vector/bundle.js

> vector-web@0.1.2 start:skins:css C:\Users\Joseph\vector-web
> catw "src/skins/vector/css/**/*.css" -o vector/bundle.css
Hash: a3d8b12232cc7d3f271a
Version: webpack 1.12.9
Time: 6033ms
Asset Size Chunks Chunk Names
bundle.js 1.62 MB 0 [emitted] main
bundle.js.map 2.1 MB 0 [emitted] main
+ 338 hidden modules
 
### Post Build ###
 
Browse to http://localhost:8080
If you need to register account click "register account" link
One you have an account:
Select "use custom server options"
Ensure link to your homeserver is set:


//============================== install matrix home server

home server url: https://web.tradervoicebox.com:8448
You can use tvblite18 / N3wGKTp@$$ as login/password


