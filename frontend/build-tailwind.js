const tailwindcss = require("tailwindcss");
const fs = require("fs");
const postcss = require("postcss");

const inputCSS = fs.readFileSync("./src/index.css", "utf8");

postcss([tailwindcss("./tailwind.config.js")])
  .process(inputCSS, { from: "./src/index.css", to: "./dist/output.css" })
  .then(result => {
    fs.writeFileSync("./dist/output.css", result.css);
    console.log("Tailwind CSS built successfully!");
  })
  .catch(err => console.error(err));
