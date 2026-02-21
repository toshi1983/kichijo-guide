const fs = require('fs');
const pdf = require('pdf-parse');

const filePath = process.argv[2];

if (!filePath) {
    console.error("Please provide a file path");
    process.exit(1);
}

let dataBuffer = fs.readFileSync(filePath);

pdf(dataBuffer).then(function (data) {
    console.log(data.text);
}).catch(function (error) {
    console.error(error);
});
