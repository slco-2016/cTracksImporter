# cTracksImporter
Use this to run an import that creates notifications for case managers on new court dates from Ctracks data.

# Steps

- place `data.csv` and `data.unl` in the cTracksImporter folder
- make sure that you're running the right version of node `nvm use 6.5.0`
- make sure you have all the requirements installed `npm install`
- copy or update a `credentials.js` file with database credentials included
- run the script on production `CCENV=production node loader.js`
