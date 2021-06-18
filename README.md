# node-squoosh-folder

Utility script to run [Squoosh](https://squoosh.app/) image compression library on each file in a given folder.

**Note:** If the image file contains EXIF data to tell the device the correct orientation, the resulting image will be rotated (Squoosh will strip any EXIF data). To avoid this, the script will tell Squoosh to rotate the image based on the EXIF orientation value before running the compression.

**Note:** The script runs Squoosh with fixed settings (mozjpeg, quality 75).

## TODO

- [ ] Flip images (not only rotate)
- [ ] Keep folder structure
- [ ] Ask for Squoosh settings on runtime

## How to run

```sh
npm install
node index.js <inputFolder> <outputFolder>
```

For example

```sh
node index.js images/ results/
```
