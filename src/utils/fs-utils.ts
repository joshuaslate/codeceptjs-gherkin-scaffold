import * as fs from 'fs';
import * as path from 'path';
import * as mkdirp from 'mkdirp';

export const getFile = async (absolutePath: string): Promise<string> =>
  new Promise((resolve, reject) =>
    fs.readFile(absolutePath, 'utf8', (error, data) => {
      if (error) {
        reject(error);
      } else {
        resolve(data);
      }
    }));

export const doesFileExist = async (absolutePath: string): Promise<boolean> =>
  new Promise((resolve, reject) =>
    fs.access(absolutePath, fs.constants.R_OK, (err) => {
      if (err) {
        reject(false);
      } else {
        resolve(true);
      }
    }));

export const canWriteFile = async (absolutePath: string): Promise<boolean> =>
  new Promise((resolve, reject) =>
    fs.access(absolutePath, fs.constants.W_OK, (err) => {
      if (err) {
        reject(false);
      } else {
        resolve(true);
      }
    }));

export const ensureFile = async (filePath: string): Promise<void> =>
  new Promise((resolve, reject) =>
    mkdirp(path.dirname(filePath), function (err) {
      if (err) {
        reject(err);
      } else {
        fs.writeFile(filePath, '', writeErr => {
          if (writeErr) {
            reject(writeErr);
          } else {
            resolve();
          }
        });
      }
    }));

const getFilesFromFolder = async (folder: string): Promise<string[]> =>
  new Promise((resolve, reject) =>
    fs.readdir(folder, (err, files) => {
      if (err) {
        reject(err);
      } else {
        resolve(files);
      }
    }));

export const getFilesRecursively = async (folderOrFile: string): Promise<string[]> =>
  new Promise((resolve, reject) =>
    fs.stat(folderOrFile, async (err, stats) => {
      if (err) {
        reject(err);
      }

      if (stats.isDirectory()) {
        const directoryContents = await getFilesFromFolder(folderOrFile);
        const nestedFiles = await Promise.all(directoryContents.map(f => getFilesRecursively(path.join(folderOrFile, f))));
        resolve((Array.prototype.concat(...nestedFiles)));
      } else {
        resolve([folderOrFile]);
      }
    }));
