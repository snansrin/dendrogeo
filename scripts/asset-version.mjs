import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
export function releaseVersion(root){
 const value=JSON.parse(readFileSync(join(root,'release-version.json'),'utf8')).version;
 if(!/^[A-Za-z0-9]+$/.test(value))throw Error('Invalid release version');
 return value;
}
export function assetVersion(root,path){
 return releaseVersion(root)+createHash('sha256').update(readFileSync(join(root,path))).digest('hex').slice(0,8);
}
