const path = require('path');
const fs = require('fs');
const readline = require('readline');
const colors = require('colors');
const { ExifImage } = require('exif');
const squoosh = require('@squoosh/lib');

const { ImagePool } = squoosh;

function readFilesInDirectory(directory) {
  // Read files and folders in current directory
  const itemsInFolder = fs.readdirSync(directory);
  // Check if the directory is empty
  if (itemsInFolder.length >= 0) {
    // Accumulate all files in the current directory
    const files = [];
    itemsInFolder.forEach((item) => {
      const absolute = path.join(directory, item);
      if (fs.statSync(absolute).isDirectory()) {
        // If the item is a directory, read the files inside it and
        // add them to the files from the current directory
        readFilesInDirectory(absolute).forEach((file) => {
          files.push(file);
        });
      } else {
        // If the item is a file, add to the array
        files.push(absolute);
      }
    });
    return files;
  }
  return [];
}

function getExifData(imagePath) {
  return new Promise((resolve, reject) => {
    // eslint-disable-next-line no-new
    new ExifImage({ image: imagePath }, ((error, exifData) => {
      if (error) {
        reject(error.message);
      } else {
        resolve(exifData);
      }
    }));
  });
}

async function runSquoosh(imagePath, filename, outputFolderPath) {
  const imagePool = new ImagePool();
  // Step 1: Get orientation details. If the orientation of the image is set in exif
  // squoosh will ignore it and we will get a rotated image.
  // We need to get the original orientation value and tell squoosh to rotate the
  // image to the original position
  let orientation;
  try {
    const exifData = await getExifData(imagePath);
    orientation = exifData.image.Orientation;
  } catch (e) {
    console.log('Unable to retrieve orientation data');
  }
  let rotations = 0;
  switch (orientation) {
    case 6:
      rotations = 1;
      break;
    case 8:
      rotations = 3;
      break;
    case 3:
      rotations = 2;
      break;
    default:
      rotations = 0;
  }

  // Step 2: Ingest image
  // Accepts both file paths and Buffers/TypedArrays.
  const image = await imagePool.ingestImage(imagePath);

  // Step 3. Decode image. This will get us the image dimensions, size, etc.
  // This could be useful if we want to improve the resize
  // const decodedImage = await image.decoded;
  // Wait until the image is decoded before running preprocessors

  // Step 4: Resize and rotate the image
  const preprocessOptions = {
    resize: {
      enabled: true,
      height: 1500,
    },
    rotate: {
      numRotations: rotations,
    },
  };
  await image.preprocess(preprocessOptions);

  // Step 5: Encode using the selected encoder (mozjpeg)
  await image.encode({ mozjpeg: { quality: 75 } });

  // Step 6: Save encoded image to disk
  const { extension, binary } = await image.encodedWith.mozjpeg;
  fs.writeFileSync(`${outputFolderPath}/${filename}.${extension}`, binary);

  imagePool.close();
}

// Ask the user if we should delete the content of the output folder
// before running the script
function deleteOutputFilesPrompt() {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    // Common user input handler
    function handleUserSelection(input) {
      const userSelection = input.toLowerCase();
      if (userSelection === 'y' || userSelection === 'yes') {
        rl.close();
        resolve(true);
      } else if (userSelection === 'n' || userSelection === 'no') {
        rl.close();
        resolve(false);
      }
    }

    // Ask the user if we should delete the content
    rl.question('Output directory is not empty. Delete before continue? (Y/N) ', handleUserSelection);
    // If the user input is not valid, keep listening for lines
    rl.on('line', handleUserSelection);
  });
}

async function main() {
  // Get input and output folders from arguments
  const appArgs = process.argv.slice(2);
  if (appArgs.length !== 2) {
    console.log('Invalid command: Include <input> and <output> directories when calling this script.');
    console.log('For example: node index.js images/ results/');
    process.exit();
  }
  const inputFolderPath = appArgs[0];
  const outputFolderPath = appArgs[1];

  if (fs.existsSync(outputFolderPath)) {
    // Check if the output folder is empty
    const outputFolderFiles = fs.readdirSync(outputFolderPath);
    if (outputFolderFiles.length !== 0) {
      const deleteFiles = await deleteOutputFilesPrompt();
      if (deleteFiles) {
        console.log('Deleting files from output folder...');
        outputFolderFiles.forEach((file) => {
          fs.unlinkSync(path.join(outputFolderPath, file));
        });
      } else {
        console.log('Keeping files from output folder...');
      }
    }
  } else {
    fs.mkdirSync(outputFolderPath, { recursive: true });
  }

  console.log(colors.yellow(`Reading files in (${inputFolderPath})...`));
  const files = readFilesInDirectory(inputFolderPath);
  console.log(colors.green(`${files.length} files found`));

  let index = 1;
  // eslint-disable-next-line no-restricted-syntax
  for (const file of files) {
    console.log(colors.blue(`File ${index}/${files.length}: ${file}`));
    const filename = path.basename(file).replace(/\.[^/.]+$/, '');
    // eslint-disable-next-line no-await-in-loop
    await runSquoosh(file, filename, outputFolderPath);
    index += 1;
  }
}

main();
