import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowsClockwise,
  Eye,
  EyeSlash,
  Check,
  X,
  CircleNotch,
} from '@phosphor-icons/react';
import { AppItem } from '../../types/index.js';
import { Button8State } from './Button8State.js';

export type DatabaseType = 'postgres' | 'mongodb' | 'mariadb' | 'mysql' | 'redis' | 'libsql';

export interface DatabaseOption {
  type: DatabaseType;
  label: string;
  defaultImage: string;
  defaultUser?: string;
  defaultDbName?: string;
  hasUserAndDb: boolean;
  hasRootPassword?: boolean;
  icon: React.ReactNode;
}

export const DATABASE_OPTIONS: DatabaseOption[] = [
  {
    type: 'postgres',
    label: 'PostgreSQL',
    defaultImage: 'postgres:18-alpine',
    defaultUser: 'postgres',
    defaultDbName: 'postgres',
    hasUserAndDb: true,
    icon: (
      <svg className="w-8 h-8" viewBox="0 0 432.071 445.383"><g style={{fillRule: 'nonzero', clipRule: 'nonzero', fill: 'none', stroke: '#fff', strokeWidth: '12.4651', strokeLinecap: 'round', strokeLinejoin: 'round', strokeMiterlimit: '4'}}><path d="M323.205 324.227c2.833-23.601 1.984-27.062 19.563-23.239l4.463.392c13.517.615 31.199-2.174 41.587-7 22.362-10.376 35.622-27.7 13.572-23.148-50.297 10.376-53.755-6.655-53.755-6.655 53.111-78.803 75.313-178.836 56.149-203.322-52.27-66.789-142.748-35.206-144.262-34.386l-.482.089c-9.938-2.062-21.06-3.294-33.554-3.496-22.761-.374-40.032 5.967-53.133 15.904 0 0-161.408-66.498-153.899 83.628 1.597 31.936 45.777 241.655 98.47 178.31 19.259-23.163 37.871-42.748 37.871-42.748 9.242 6.14 20.307 9.272 31.912 8.147l.897-.765c-.281 2.876-.157 5.689.359 9.019-13.572 15.167-9.584 17.83-36.723 23.416-27.457 5.659-11.326 15.734-.797 18.367 12.768 3.193 42.305 7.716 62.268-20.224l-.795 3.188c5.325 4.26 4.965 30.619 5.72 49.452.756 18.834 2.017 36.409 5.856 46.771 3.839 10.36 8.369 37.05 44.036 29.406 29.809-6.388 52.6-15.582 54.677-101.107" style={{fill: '#000', stroke: '#000', strokeWidth: '37.3953', strokeLinecap: 'butt', strokeLinejoin: 'miter'}}/><path stroke="none" d="M402.395 271.23c-50.302 10.376-53.76-6.655-53.76-6.655 53.111-78.808 75.313-178.843 56.153-203.326-52.27-66.785-142.752-35.2-144.262-34.38l-.486.087c-9.938-2.063-21.06-3.292-33.56-3.496-22.761-.373-40.026 5.967-53.127 15.902 0 0-161.411-66.495-153.904 83.63 1.597 31.938 45.776 241.657 98.471 178.312 19.26-23.163 37.869-42.748 37.869-42.748 9.243 6.14 20.308 9.272 31.908 8.147l.901-.765c-.28 2.876-.152 5.689.361 9.019-13.575 15.167-9.586 17.83-36.723 23.416-27.459 5.659-11.328 15.734-.796 18.367 12.768 3.193 42.307 7.716 62.266-20.224l-.796 3.188c5.319 4.26 9.054 27.711 8.428 48.969-.626 21.259-1.044 35.854 3.147 47.254 4.191 11.4 8.368 37.05 44.042 29.406 29.809-6.388 45.256-22.942 47.405-50.555 1.525-19.631 4.976-16.729 5.194-34.28l2.768-8.309c3.192-26.611.507-35.196 18.872-31.203l4.463.392c13.517.615 31.208-2.174 41.591-7 22.358-10.376 35.618-27.7 13.573-23.148z" style={{fill: '#336791', stroke: 'none'}}/><path d="M215.866 286.484c-1.385 49.516.348 99.377 5.193 111.495 4.848 12.118 15.223 35.688 50.9 28.045 29.806-6.39 40.651-18.756 45.357-46.051 3.466-20.082 10.148-75.854 11.005-87.281M173.104 38.256S11.583-27.76 19.092 122.365c1.597 31.938 45.779 241.664 98.473 178.316 19.256-23.166 36.671-41.335 36.671-41.335M260.349 26.207c-5.591 1.753 89.848-34.889 144.087 34.417 19.159 24.484-3.043 124.519-56.153 203.329"/><path d="M348.282 263.953s3.461 17.036 53.764 6.653c22.04-4.552 8.776 12.774-13.577 23.155-18.345 8.514-59.474 10.696-60.146-1.069-1.729-30.355 21.647-21.133 19.96-28.739-1.525-6.85-11.979-13.573-18.894-30.338-6.037-14.633-82.796-126.849 21.287-110.183 3.813-.789-27.146-99.002-124.553-100.599-97.385-1.597-94.19 119.762-94.19 119.762" style={{strokeLinejoin: 'bevel'}}/><path d="M188.604 274.334c-13.577 15.166-9.584 17.829-36.723 23.417-27.459 5.66-11.326 15.733-.797 18.365 12.768 3.195 42.307 7.718 62.266-20.229 6.078-8.509-.036-22.086-8.385-25.547-4.034-1.671-9.428-3.765-16.361 3.994z"/><path d="M187.715 274.069c-1.368-8.917 2.93-19.528 7.536-31.942 6.922-18.626 22.893-37.255 10.117-96.339-9.523-44.029-73.396-9.163-73.436-3.193-.039 5.968 2.889 30.26-1.067 58.548-5.162 36.913 23.488 68.132 56.479 64.938"/><path d="M172.517 141.7c-.288 2.039 3.733 7.48 8.976 8.207 5.234.73 9.714-3.522 9.998-5.559.284-2.039-3.732-4.285-8.977-5.015-5.237-.731-9.719.333-9.996 2.367z" style={{fill: '#fff', strokeWidth: '4.155', strokeLinecap: 'butt', strokeLinejoin: 'miter'}}/><path d="M331.941 137.543c.284 2.039-3.732 7.48-8.976 8.207-5.238.73-9.718-3.522-10.005-5.559-.277-2.039 3.74-4.285 8.979-5.015 5.239-.73 9.718.333 10.002 2.368z" style={{fill: '#fff', strokeWidth: '2.0775', strokeLinecap: 'butt', strokeLinejoin: 'miter'}}/><path d="M350.676 123.432c.863 15.994-3.445 26.888-3.988 43.914-.804 24.748 11.799 53.074-7.191 81.435"/></g></svg>
    ),
  },
  {
    type: 'mongodb',
    label: 'MongoDB',
    defaultImage: 'mongo:7',
    defaultUser: 'mongo',
    defaultDbName: 'app_db',
    hasUserAndDb: true,
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 120 257"><path fill="#00ED64" d="M82.323 28.55C71.537 15.795 62.249 2.84 60.35.15c-.2-.2-.5-.2-.7 0-1.897 2.69-11.185 15.645-21.971 28.4C-54.902 146.238 52.26 225.661 52.26 225.661l.9.597c.798 12.258 2.795 29.896 2.795 29.896h7.99s1.998-17.539 2.797-29.896l.899-.697c.1 0 107.263-79.323 14.68-197.01ZM59.95 223.867s-4.793-4.086-6.092-6.179v-.199l5.793-128.151c0-.4.6-.4.6 0l5.792 128.151v.199c-1.299 2.093-6.093 6.179-6.093 6.179Z"/></svg>
    ),
  },
  {
    type: 'mariadb',
    label: 'MariaDB',
    defaultImage: 'mariadb:11',
    defaultUser: 'mariadb',
    defaultDbName: 'app_db',
    hasUserAndDb: true,
    hasRootPassword: true,
    icon: (
      <svg className="w-8 h-8" preserveAspectRatio="xMidYMid" viewBox="0 0 256 170"><path d="M250.4 0c-4 .1-2.7 1.3-11.3 3.4-8.6 2.1-19.1 1.4-28.4 5.3-27.8 11.7-33.4 51.5-58.6 65.7-18.9 10.7-37.9 11.5-55 16.9a100.6 100.6 0 0 0-33.7 19.5c-8 6.8-8.1 12.8-16.4 21.4-8.8 9.1-35 .1-47 14.1 3.8 3.9 5.5 5 13 4-1.5 3-10.7 5.4-9 9.8 2 4.6 24.3 7.7 44.6-4.5 9.4-5.7 17-14 31.7-16 19-2.5 41 1.7 63 4.9-3.3 9.7-9.9 16.2-15.1 24-1.7 1.7 3.2 2 8.8.9 10-2.5 17.3-4.5 24.9-9 9.3-5.4 10.7-19.3 22.1-22.3 6.4 9.8 23.7 12.1 34.5 4.3-9.4-2.7-12-22.8-8.9-31.6 3-8.4 6-21.8 9-32.8 3.3-12 4.5-26.9 8.5-33 6-9 12.5-12.2 18.2-17.3 5.7-5.2 10.9-10.2 10.7-22 0-3.7-2-5.8-5.6-5.7Z" fill="#002B64" className="dark:fill-[#588ec4]"/><path d="M242 7c.9 3.2 2.3 4.7 8.8 5.3-1 8.1-6.4 12.6-12.5 16.8-5.3 3.8-11.2 7.4-15 13.3-3.8 6-6.3 26.5-12.3 46.8-5.1 17.5-13 34.9-26.6 42.5-1.4-3.6.2-10.2-2.6-12.4-1.9 5.2-4 10.2-6.4 14.9a53.2 53.2 0 0 1-39.6 30.2c9.4-12.7 18.3-25.8 18.5-47.7-6.6 1.4-6.4 17-13.2 21.2-4.4.5-8.8.5-13.2.2-18.3-1.1-37-6.6-54-1.1-11.7 3.7-21.2 12.5-31 16.8-11.6 5-20.3 7-34.7 5-1.9-2.5 10.5-5.6 9.8-11-5.7-.6-9 .7-13.8-1.5.5-1 1.3-1.8 2.3-2.5 9-6.2 34.5-1.5 41.3-8.2 4.2-4.1 7-8.4 9.8-12.6A51.2 51.2 0 0 1 73 107.4c7.4-5 16.6-9.7 25.7-12.9 12.4-4.3 24.9-4.7 38-9.7 8.2-3.1 17-7 24.2-12.3 1.7-1.3 3.4-2.7 4.9-4.1 20.6-20 24.6-55.5 56.7-58.8 4-.4 7.1-.2 10-.3 3.3-.1 6.3-.5 9.5-2.3Zm-39.2 113.3c.3 6.1 3.9 18.3 7 21.2-6.1 1.5-16.7-1-19.4-5.3 1.4-6.3 8.6-12 12.4-16Z" fill="#C49A6C"/><path d="M244.2 13.8c-1.2 2.6-3.6 6-3.6 12.6 0 1.1-.9 1.9-.9.2.1-6.5 1.8-9.3 3.6-13 .9-1.5 1.4-.9 1 .2Zm-1.2-1c-1.5 2.5-5 7-5.6 13.6 0 1.2-1 1.9-.9.1.7-6.4 3.5-10.4 5.6-14 1-1.3 1.4-.7.9.4Zm-1.2-1.2c-1.6 2.3-7 7.7-8.2 14.2-.2 1.2-1.1 1.8-.9 0 1.2-6.3 5.9-11.3 8.3-14.6 1-1.3 1.5-.6.8.4Zm-1-1.5-.5.6c-2.4 2.6-8 9-10 14.7-.3 1-1.4 1.6-.8-.1 2-6.1 7.7-12.7 10.5-15.7 1.3-1.1 1.6-.4.8.5Zm-29 13.1c1.2-5.4 5.4-7.8 12.6-7.2 1.8 8-8 11.3-12.6 7.2Z" fill="#002B64" className="dark:fill-[#588ec4]"/></svg>
    ),
  },
  {
    type: 'mysql',
    label: 'MySQL',
    defaultImage: 'mysql:8',
    defaultUser: 'mysql',
    defaultDbName: 'app_db',
    hasUserAndDb: true,
    hasRootPassword: true,
    icon: (
      <svg className="w-8 h-8" preserveAspectRatio="xMidYMid" viewBox="0 0 256 252"><path fill="#00546B" className="dark:fill-[#38bdf8]" d="M236 194c-14 0-25 1-34 5-3 1-7 1-7 4l3 6c2 3 5 8 9 11l11 8 21 10 11 9 6 4-3-6-5-5c-5-7-11-13-18-18-6-3-18-9-20-15h-1l12-3 18-3 8-2v-2l-9-10c-8-8-18-15-28-22l-18-8c-2-1-6-2-7-4l-7-13-15-30-8-20c-18-30-38-48-68-65-6-4-14-5-22-7l-13-1-8-6C34 5 8-9 1 9c-5 11 7 22 11 28l9 13 3 9c3 8 5 17 9 24l6 10c2 2 4 3 5 6-3 4-3 9-4 13-7 20-4 44 5 59 2 4 9 14 18 10 8-3 6-13 8-22l1-4 8 14c5 9 14 18 22 24 4 3 8 8 13 10l-4-4-9-10c-8-10-14-21-20-32l-7-17-3-6c-3 4-7 7-9 12-3 7-3 17-4 26h-1c-6-1-8-7-10-12-5-12-6-32-1-46 1-4 6-15 4-19-1-3-4-5-6-7l-7-12-10-30-9-13c-3-5-7-8-10-14-1-2-2-5 0-7l2-2c2-2 9 0 11 1 6 3 12 5 17 9l8 6h4c6 1 12 0 17 2 9 3 18 7 25 12 23 14 42 35 54 59 3 4 3 8 5 12l12 26c4 8 7 16 12 23 3 4 14 6 18 8l12 4 18 12c2 2 11 7 12 10Z"/><path fill="#00546B" className="dark:fill-[#38bdf8]" d="m58 43-7 1 6 7 4 9v-1c3-1 4-4 4-8l-2-4-5-4Z"/></svg>
    ),
  },
  {
    type: 'redis',
    label: 'Redis',
    defaultImage: 'redis:7-alpine',
    hasUserAndDb: false,
    icon: (
      <svg className="w-8 h-8" preserveAspectRatio="xMidYMid" viewBox="0 0 256 220"><path d="M246 169c-13.7 7-84.5 36.2-99.5 44-15.1 7.9-23.5 7.8-35.4 2.1C99.2 209.4 24 179 10.3 172.5 3.6 169.3 0 166.5 0 164v-26s98-21.3 113.9-27c15.8-5.6 21.3-5.8 34.8-.9 13.4 5 94 19.5 107.3 24.3V160c0 2.5-3 5.3-10 9" fill="#912626"/><path d="M246 143.2c-13.7 7.1-84.5 36.2-99.5 44-15.1 8-23.5 7.9-35.4 2.2-11.9-5.7-87.2-36.1-100.8-42.6-13.5-6.5-13.8-11-.5-16.2 13.4-5.2 88.2-34.6 104-40.3 16-5.6 21.4-5.8 34.9-1 13.4 5 83.8 33 97.1 37.9 13.3 4.9 13.8 8.9.2 16" fill="#C6302B"/><path d="M246 127c-13.7 7.2-84.5 36.3-99.5 44.2-15.1 7.8-23.5 7.7-35.4 2-11.9-5.6-87.2-36-100.8-42.6-6.7-3.2-10.3-6-10.3-8.5V96.2s98-21.3 113.9-27c15.8-5.7 21.3-5.9 34.8-1 13.4 5 94 19.5 107.3 24.4V118c0 2.5-3 5.4-10 9" fill="#912626"/><path d="M246 101.4c-13.7 7-84.5 36.2-99.5 44-15.1 7.9-23.5 7.8-35.4 2.1C99.2 141.8 24 111.4 10.3 105c-13.5-6.5-13.8-11-.5-16.1C23.2 83.5 98 54 113.8 48.5c16-5.7 21.4-6 34.9-1 13.4 5 83.8 33 97.1 37.8 13.3 5 13.8 9 .2 16" fill="#C6302B"/><path d="M246 83.7c-13.7 7-84.5 36.2-99.5 44-15.1 7.9-23.5 7.8-35.4 2.1C99.2 124.1 24 93.7 10.3 87.2 3.6 84 0 81.2 0 78.7v-26s98-21.3 113.9-27c15.8-5.6 21.3-5.8 34.8-.9 13.4 5 94 19.5 107.3 24.4v25.5c0 2.5-3 5.3-10 9" fill="#912626"/><path d="M246 58c-13.7 7-84.5 36.1-99.5 44-15.1 7.9-23.5 7.8-35.4 2C99.2 98.5 24 68 10.3 61.6c-13.5-6.5-13.8-11-.5-16.2C23.2 40.1 98 10.7 113.8 5c16-5.6 21.4-5.8 34.9-.9 13.4 5 83.8 33 97.1 37.8 13.3 4.9 13.8 9 .2 16" fill="#C6302B"/><path d="m159.3 32.8-22 2.2-5 11.9-8-13.2L99 31.4l19-6.9-5.8-10.5 17.8 7 16.7-5.5-4.5 10.9 17 6.4M131 90.3l-41-17 58.8-9.1-17.8 26M74 39.3c17.5 0 31.5 5.5 31.5 12.2 0 6.8-14 12.2-31.4 12.2s-31.5-5.4-31.5-12.2c0-6.7 14.1-12.2 31.5-12.2" fill="#FFF"/><path d="M185.3 36 220 49.8l-34.8 13.7V36" fill="#621B1C"/><path d="M146.8 51.2 185.3 36v27.5l-3.8 1.5-34.7-13.8" fill="#9A2928"/></svg>
    ),
  },
  {
    type: 'libsql',
    label: 'libSQL',
    defaultImage: 'ghcr.io/tursodatabase/libsql-server:latest',
    hasUserAndDb: false,
    icon: (
      <svg className="w-8 h-8" viewBox="0 0 217.2 217.2"><path fill="#72f5cf" d="M118,87.2c.7,0,1.3,0,1.9.3.4.1.8.3,1.2.5.2.1.4.2.6.3.4.3.7.5,1.1.9l5.2,5.2c2.7,2.7,2.7,7,0,9.7l-95.1,95.1c-1.3,1.3-3.1,2-4.8,2s-3.5-.7-4.8-2l-5.2-5.2c-2.7-2.7-2.7-7,0-9.7l85.1-85.1,10-10c.3-.3.7-.6,1.1-.9.2-.1.4-.2.6-.3.4-.2.8-.4,1.2-.5.6-.2,1.3-.3,1.9-.3M118,71.2c-2.2,0-4.4.3-6.5.9-1.4.4-2.8,1-4.1,1.7-.7.4-1.3.7-2,1.2-1.3.8-2.5,1.8-3.6,2.9l-10,10L6.7,173c-8.9,8.9-8.9,23.4,0,32.3l5.2,5.2c4.3,4.3,10.1,6.7,16.2,6.7s11.8-2.4,16.2-6.7l95.1-95.1c4.3-4.3,6.7-10.1,6.7-16.2s-2.4-11.8-6.7-16.2l-5.2-5.2c-1.1-1.1-2.3-2.1-3.6-2.9-.6-.4-1.3-.8-1.9-1.2-1.3-.7-2.7-1.3-4.1-1.7-2.1-.6-4.3-.9-6.5-.9h0Z"/><g><path fill="#72f5cf" d="M119.4,16c.3,0,.6,0,.9,0l66.5,3.8c5.8.3,10.3,4.9,10.7,10.7l3.8,66.5c.3,4.4-1.4,8.7-4.5,11.8l-79.7,79.7c-3,3-6.9,4.5-11,4.5s-3.3-.3-4.9-.8l-49.9-16.5c-4.7-1.5-8.3-5.2-9.8-9.8l-16.5-49.9c-1.8-5.6-.4-11.7,3.8-15.8L108.4,20.5c2.9-2.9,6.9-4.5,11-4.5M119.4,0c-8.4,0-16.3,3.3-22.3,9.2L17.4,88.9c-8.5,8.5-11.4,20.8-7.6,32.1l16.5,49.9c3.1,9.4,10.6,16.9,20,20l49.9,16.5c3.2,1.1,6.5,1.6,9.9,1.6,8.4,0,16.3-3.3,22.3-9.2l79.7-79.7c6.3-6.3,9.7-15.1,9.2-24.1l-3.8-66.5c-.8-13.9-11.9-24.9-25.7-25.7L121.2,0c-.6,0-1.2,0-1.8,0h0Z"/><path fill="#a8f7d9" d="M24.9,116.1l16.5,49.9c1.5,4.7,5.2,8.3,9.8,9.8l49.9,16.5c5.6,1.8,11.7.4,15.8-3.8l79.7-79.7c3.1-3.1,4.8-7.4,4.5-11.8l-3.8-66.5c-.3-5.8-4.9-10.3-10.7-10.7l-66.5-3.8c-4.4-.3-8.7,1.4-11.8,4.5L28.7,100.3c-4.1,4.1-5.6,10.3-3.8,15.8Z"/><path fill="#141b1f" className="dark:fill-slate-300" d="M119.4,16c.3,0,.6,0,.9,0l66.5,3.8c5.8.3,10.3,4.9,10.7,10.7l3.8,66.5c.3,4.4-1.4,8.7-4.5,11.8l-79.7,79.7c-3,3-6.9,4.5-11,4.5s-3.3-.3-4.9-.8l-49.9-16.5c-4.7-1.5-8.3-5.2-9.8-9.8l-16.5-49.9c-1.8-5.6-.4-11.7,3.8-15.8L108.4,20.5c2.9-2.9,6.9-4.5,11-4.5M119.4,6c-6.8,0-13.2,2.7-18,7.5L21.6,93.2c-6.8,6.8-9.2,16.8-6.2,26l16.5,49.9c2.5,7.6,8.6,13.7,16.2,16.2l49.9,16.5c2.6.9,5.3,1.3,8,1.3,6.8,0,13.2-2.7,18-7.5l79.7-79.7c5.1-5.1,7.8-12.2,7.4-19.5l-3.8-66.5c-.6-10.8-9.3-19.5-20.1-20.1l-66.5-3.8c-.5,0-1,0-1.5,0h0Z"/><path fill="#141b1f" className="dark:fill-slate-300" d="M136.7,173.7l6.9-6.9c-.2-.1-.4-.2-.6-.3l-27.6-9.1-6.9,6.9,28.3,9.3Z"/><path fill="#141b1f" className="dark:fill-slate-300" d="M166.5,143.9l6.9-6.9c-.2-.1-.4-.2-.6-.3l-27.6-9.1-6.9,6.9,28.3,9.3Z"/><path fill="#141b1f" className="dark:fill-slate-300" d="M43.5,80.5l6.9-6.9c.1.2.2.4.3.6l9.1,27.6-6.9,6.9-9.3-28.3Z"/><path fill="#141b1f" className="dark:fill-slate-300" d="M73.3,50.7l6.9-6.9c.1.2.2.4.3.6l9.1,27.6-6.9,6.9-9.3-28.3Z"/></g><path fill="#79ac91" d="M130.6,101.5l-97.7,97.7c-2.7,2.7-7,2.7-9.7,0l-5.2-5.2c-2.7-2.7-2.7-7,0-9.7l97.7-97.7c1.5-1.5,3.4-2.4,5.5-2.6l7.9-.8c2.8-.3,5.1,2.1,4.9,4.9l-.8,7.9c-.2,2.1-1.1,4-2.6,5.5Z"/><path fill="#141b1f" className="dark:fill-slate-300" d="M129.5,83.3c2.6,0,4.7,2.2,4.4,4.9l-.8,7.9c-.2,2.1-1.1,4-2.6,5.5l-97.7,97.7c-1.3,1.3-3.1,2-4.8,2s-3.5-.7-4.8-2l-5.2-5.2c-2.7-2.7-2.7-7,0-9.7l97.7-97.7c1.5-1.5,3.4-2.4,5.5-2.6l7.9-.8c.1,0,.3,0,.4,0M129.5,73.3h0c-.5,0-.9,0-1.4,0l-7.9.8c-4.4.4-8.5,2.4-11.5,5.5L10.9,177.3c-6.6,6.6-6.6,17.3,0,23.8l5.2,5.2c3.2,3.2,7.4,4.9,11.9,4.9s8.7-1.8,11.9-4.9l97.7-97.7c3.1-3.1,5-7.2,5.5-11.5l.8-7.9c.4-4-.9-8.1-3.7-11.1-2.7-3-6.6-4.7-10.7-4.7h0Z"/></svg>
    ),
  },
];

function generateSecurePassword(length = 24): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const array = new Uint8Array(length);
  window.crypto.getRandomValues(array);
  return Array.from(array, (byte) => chars[byte % chars.length]).join('');
}

interface CreateDatabaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateDatabase: (appData: Partial<AppItem>) => Promise<any>;
}

export const CreateDatabaseModal: React.FC<CreateDatabaseModalProps> = ({
  isOpen,
  onClose,
  onCreateDatabase,
}) => {
  const [selectedType, setSelectedType] = useState<DatabaseType>('postgres');
  const [name, setName] = useState('');
  const [dbName, setDbName] = useState('');
  const [dbUser, setDbUser] = useState('');
  const [dbPassword, setDbPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [dbRootPassword, setDbRootPassword] = useState('');
  const [showRootPassword, setShowRootPassword] = useState(false);
  const [dockerImage, setDockerImage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scrollBodyRef = useRef<HTMLDivElement>(null);
  const formSectionRef = useRef<HTMLDivElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const currentOption = DATABASE_OPTIONS.find((o) => o.type === selectedType) || DATABASE_OPTIONS[0];

  // Initialize or reset defaults when switching database type
  useEffect(() => {
    if (isOpen) {
      setDbPassword(generateSecurePassword(20));
      setDbRootPassword(generateSecurePassword(20));
      setName(`${selectedType}-db`);
      setDbName('');
      setDbUser('');
      setDockerImage('');
      setError(null);
    }
  }, [selectedType, isOpen]);

  // Handle ESC key and prevent body scrolling when modal is open
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSubmitting) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen, isSubmitting, onClose]);

  const handleSelectType = (type: DatabaseType) => {
    setSelectedType(type);
    if (typeof window !== 'undefined' && window.innerWidth < 640 && formSectionRef.current) {
      setTimeout(() => {
        formSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        nameInputRef.current?.focus({ preventScroll: true });
      }, 80);
    }
  };

  const handleGeneratePassword = () => {
    setDbPassword(generateSecurePassword(20));
  };

  const handleGenerateRootPassword = () => {
    setDbRootPassword(generateSecurePassword(20));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('请输入数据库实例名称 (Name)');
      return;
    }
    if (!dbPassword.trim()) {
      setError('请输入或生成数据库访问密码 (Database Password)');
      return;
    }
    if (currentOption.hasRootPassword && !dbRootPassword.trim()) {
      setError('请输入或生成 Root 密码 (Database Root password)');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const imageToUse = dockerImage.trim() || currentOption.defaultImage;
    const finalDbName = dbName.trim() || currentOption.defaultDbName || 'app_db';
    const finalDbUser = dbUser.trim() || currentOption.defaultUser || 'root';

    // Prevent MySQL/MariaDB official images from failing due to user being root
    if ((selectedType === 'mysql' || selectedType === 'mariadb') && finalDbUser.toLowerCase() === 'root') {
      setError(`${currentOption.label} 官方镜像限制：Database User 不能设置为 "root"（root 用户密码已由下方独立的 Database Root password 管理）。请指定其他普通用户名（如 ${currentOption.defaultUser}）或保持默认。`);
      return;
    }

    // Generate stable app ID and internal hostname (e.g. postgres-db-xxxx)
    const generatedId = name.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-').slice(0, 32) + '-' + Math.random().toString(36).slice(2, 6);

    // Assemble Docker Compose YAML and .env
    let composeYaml = '';
    let envContent = '';

    switch (selectedType) {
      case 'postgres': {
        const isPgLegacy = /postgres:(?:1[0-7]|[1-9])(?:[.-]|$)/.test(imageToUse);
        const pgMountPath = isPgLegacy ? '/var/lib/postgresql/data' : '/var/lib/postgresql';
        const pgDataEnv = isPgLegacy ? '\n      PGDATA: /var/lib/postgresql/data/pgdata' : '';

        composeYaml = `services:
  database:
    image: \${POSTGRES_IMAGE:-${imageToUse}}
    container_name: \${CONTAINER_NAME:-${generatedId}}
    restart: unless-stopped
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U "$\${POSTGRES_USER}" -d "$\${POSTGRES_DB}"']
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 30s
    environment:
      POSTGRES_DB: \${POSTGRES_DB:-${finalDbName}}
      POSTGRES_USER: \${POSTGRES_USER:-${finalDbUser}}
      POSTGRES_PASSWORD: \${POSTGRES_PASSWORD}${pgDataEnv}
    volumes:
      - ./data:${pgMountPath}
    networks:
      - default
      - vessel-net

networks:
  vessel-net:
    external: true
`;
        envContent = `POSTGRES_IMAGE=${imageToUse}
POSTGRES_DB=${finalDbName}
POSTGRES_USER=${finalDbUser}
POSTGRES_PASSWORD=${dbPassword}
# 外部网络连接已关闭 (仅限容器内网访问)
# 集群内部连接串
INTERNAL_DATABASE_URL=postgresql://${finalDbUser}:${dbPassword}@${generatedId}:5432/${finalDbName}
`;
        break;
      }

      case 'mongodb':
        composeYaml = `services:
  database:
    image: \${MONGO_IMAGE:-${imageToUse}}
    container_name: \${CONTAINER_NAME:-${generatedId}}
    restart: unless-stopped
    healthcheck:
      test: ['CMD-SHELL', 'mongosh --quiet --eval "db.adminCommand({ ping: 1 })" || mongo --quiet --eval "db.adminCommand({ ping: 1 })"']
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 40s
    environment:
      MONGO_INITDB_DATABASE: \${MONGO_INITDB_DATABASE:-${finalDbName}}
      MONGO_INITDB_ROOT_USERNAME: \${MONGO_INITDB_ROOT_USERNAME:-${finalDbUser}}
      MONGO_INITDB_ROOT_PASSWORD: \${MONGO_INITDB_ROOT_PASSWORD}
    volumes:
      - ./data:/data/db
    networks:
      - default
      - vessel-net

networks:
  vessel-net:
    external: true
`;
        envContent = `MONGO_IMAGE=${imageToUse}
MONGO_INITDB_DATABASE=${finalDbName}
MONGO_INITDB_ROOT_USERNAME=${finalDbUser}
MONGO_INITDB_ROOT_PASSWORD=${dbPassword}
# 外部网络连接已关闭 (仅限容器内网访问)
# 集群内部连接串
INTERNAL_MONGO_URL=mongodb://${finalDbUser}:${dbPassword}@${generatedId}:27017/${finalDbName}?authSource=admin
`;
        break;

      case 'mariadb':
        composeYaml = `services:
  database:
    image: \${MARIADB_IMAGE:-${imageToUse}}
    container_name: \${CONTAINER_NAME:-${generatedId}}
    restart: unless-stopped
    healthcheck:
      test: ['CMD-SHELL', 'healthcheck.sh --connect --innodb_initialized || mariadb-admin ping -h 127.0.0.1 -uroot -p"$\${MARIADB_ROOT_PASSWORD}" --silent || mysqladmin ping -h 127.0.0.1 -uroot -p"$\${MARIADB_ROOT_PASSWORD}" --silent']
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 40s
    environment:
      MARIADB_DATABASE: \${MARIADB_DATABASE:-${finalDbName}}
      MARIADB_USER: \${MARIADB_USER:-${finalDbUser}}
      MARIADB_PASSWORD: \${MARIADB_PASSWORD}
      MARIADB_ROOT_PASSWORD: \${MARIADB_ROOT_PASSWORD}
      MYSQL_ROOT_PASSWORD: \${MARIADB_ROOT_PASSWORD}
      MYSQL_DATABASE: \${MARIADB_DATABASE:-${finalDbName}}
      MYSQL_USER: \${MARIADB_USER:-${finalDbUser}}
      MYSQL_PASSWORD: \${MARIADB_PASSWORD}
      MARIADB_ROOT_HOST: "%"
      MYSQL_ROOT_HOST: "%"
    volumes:
      - ./data:/var/lib/mysql
    networks:
      - default
      - vessel-net

networks:
  vessel-net:
    external: true
`;
        envContent = `MARIADB_IMAGE=${imageToUse}
MARIADB_DATABASE=${finalDbName}
MARIADB_USER=${finalDbUser}
MARIADB_PASSWORD=${dbPassword}
MARIADB_ROOT_PASSWORD=${dbRootPassword}
MYSQL_ROOT_PASSWORD=${dbRootPassword}
# 外部网络连接已关闭 (仅限容器内网访问)
# 集群内部连接串
INTERNAL_DATABASE_URL=mysql://${finalDbUser}:${dbPassword}@${generatedId}:3306/${finalDbName}
INTERNAL_DATABASE_ROOT_URL=mysql://root:${dbRootPassword}@${generatedId}:3306/${finalDbName}
`;
        break;

      case 'mysql':
        composeYaml = `services:
  database:
    image: \${MYSQL_IMAGE:-${imageToUse}}
    container_name: \${CONTAINER_NAME:-${generatedId}}
    restart: unless-stopped
    healthcheck:
      test: ['CMD-SHELL', 'mysqladmin ping -h 127.0.0.1 -uroot -p"$\${MYSQL_ROOT_PASSWORD}" --silent']
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 40s
    environment:
      MYSQL_DATABASE: \${MYSQL_DATABASE:-${finalDbName}}
      MYSQL_USER: \${MYSQL_USER:-${finalDbUser}}
      MYSQL_PASSWORD: \${MYSQL_PASSWORD}
      MYSQL_ROOT_PASSWORD: \${MYSQL_ROOT_PASSWORD}
      MYSQL_ROOT_HOST: "%"
    volumes:
      - ./data:/var/lib/mysql
    networks:
      - default
      - vessel-net

networks:
  vessel-net:
    external: true
`;
        envContent = `MYSQL_IMAGE=${imageToUse}
MYSQL_DATABASE=${finalDbName}
MYSQL_USER=${finalDbUser}
MYSQL_PASSWORD=${dbPassword}
MYSQL_ROOT_PASSWORD=${dbRootPassword}
# 外部网络连接已关闭 (仅限容器内网访问)
# 集群内部连接串
INTERNAL_DATABASE_URL=mysql://${finalDbUser}:${dbPassword}@${generatedId}:3306/${finalDbName}
INTERNAL_DATABASE_ROOT_URL=mysql://root:${dbRootPassword}@${generatedId}:3306/${finalDbName}
`;
        break;

      case 'redis':
        composeYaml = `services:
  database:
    image: \${REDIS_IMAGE:-${imageToUse}}
    container_name: \${CONTAINER_NAME:-${generatedId}}
    restart: unless-stopped
    healthcheck:
      test: ['CMD-SHELL', 'redis-cli --no-auth-warning -a "\${REDIS_PASSWORD}" ping | grep -q PONG']
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 10s
    command: redis-server --requirepass \${REDIS_PASSWORD} --appendonly yes
    volumes:
      - ./data:/data
    networks:
      - default
      - vessel-net

networks:
  vessel-net:
    external: true
`;
        envContent = `REDIS_IMAGE=${imageToUse}
REDIS_PASSWORD=${dbPassword}
# 外部网络连接已关闭 (仅限容器内网访问)
# 集群内部连接串
INTERNAL_REDIS_URL=redis://:${dbPassword}@${generatedId}:6379
`;
        break;

      case 'libsql':
        composeYaml = `services:
  database:
    image: \${LIBSQL_IMAGE:-${imageToUse}}
    container_name: \${CONTAINER_NAME:-${generatedId}}
    restart: unless-stopped
    environment:
      SQLD_AUTH_TOKEN: \${SQLD_AUTH_TOKEN}
      SQLD_NODE: "primary"
      SQLD_HTTP_LISTEN_ADDR: "0.0.0.0:8080"
    volumes:
      - ./data:/var/lib/sqld
    networks:
      - default
      - vessel-net

networks:
  vessel-net:
    external: true
`;
        envContent = `LIBSQL_IMAGE=${imageToUse}
SQLD_AUTH_TOKEN=${dbPassword}
# 外部网络连接已关闭 (仅限容器内网访问)
# 集群内部连接串
INTERNAL_LIBSQL_URL=http://${generatedId}:8080
`;
        break;
    }

    try {
      await onCreateDatabase({
        id: generatedId,
        name: name.trim(),
        description: `Managed ${currentOption.label} Database Service`,
        composeYaml,
        envContent,
        autoUpdate: false,
      });
      onClose();
    } catch (err: any) {
      setError(err.message || '创建数据库失败');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex flex-col sm:items-center sm:justify-center sm:p-4 bg-zinc-950/40 dark:bg-black/70 backdrop-blur-[3px] animate-fade-in font-sans"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-db-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) {
          onClose();
        }
      }}
    >
      {/* Modal / Full-screen Container: 100% full-screen on mobile, centered dialog on desktop */}
      <div
        className="w-full h-full sm:h-auto sm:max-h-[90vh] sm:max-w-xl bg-paper sm:bg-paper-2 sm:rounded-[22px] sm:border sm:border-line sm:shadow-pop flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sticky Top Header */}
        <div className="sticky top-0 z-10 bg-paper sm:bg-paper-2 px-6 py-4 flex items-center justify-between shrink-0">
          <div>
            <h3 id="create-db-title" className="text-base sm:text-lg font-semibold text-ink tracking-tight font-sans">创建受管数据库</h3>
            <p className="text-[11px] sm:text-xs text-ink-muted mt-0.5">选择官方数据库引擎并配置连接参数</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="关闭窗口"
            className="w-8 h-8 rounded-lg text-ink-muted hover:text-ink hover:bg-paper-3 transition-colors flex items-center justify-center cursor-pointer"
          >
            <X className="w-4 h-4" weight="bold" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} autoComplete="off" className="flex-1 flex flex-col overflow-hidden">
          <div
            ref={scrollBodyRef}
            className="flex-1 overflow-y-auto px-6 py-4 space-y-6 no-scrollbar pb-24 sm:pb-6"
          >
            {/* Database Selection Grid (2 cols on mobile, 3 cols on desktop) */}
            <div role="radiogroup" aria-label="数据库引擎选择" className="space-y-2">
              <label className="block text-xs font-semibold text-ink-muted">选择官方数据库引擎</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3">
                {DATABASE_OPTIONS.map((db) => {
                  const isSelected = selectedType === db.type;
                  return (
                    <button
                      key={db.type}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      onClick={() => handleSelectType(db.type)}
                      className={`flex flex-col items-center justify-center p-3.5 sm:p-4 rounded-2xl text-center transition-colors cursor-pointer select-none active:scale-[0.98] ${
                        isSelected
                          ? 'bg-paper-4 shadow-sm ring-1 ring-signal-ring'
                          : 'bg-paper-3 hover:bg-paper-4/60'
                      }`}
                    >
                      <div className="mb-2 flex items-center justify-center">{db.icon}</div>
                      <span className="text-xs font-semibold text-ink">{db.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Form Fields Section */}
            <div ref={formSectionRef} className="space-y-4 pt-2">
              <h4 className="text-xs sm:text-sm font-semibold text-ink tracking-tight">填写基础配置</h4>

              {error && (
                <div className="p-3.5 bg-rose-500/10 text-rose-500 rounded-xl text-xs leading-relaxed">
                  {error}
                </div>
              )}

              {/* Name Field */}
              <div>
                <label className="block text-xs font-semibold text-ink-muted mb-1.5">实例名称 (Name)</label>
                <input
                  ref={nameInputRef}
                  type="text"
                  name="db_instance_name"
                  id="db_instance_name"
                  autoComplete="off"
                  data-1p-ignore="true"
                  data-lpignore="true"
                  data-bwignore="true"
                  data-protonpass-ignore="true"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="例如 my-postgres"
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                  className="w-full min-h-[44px] bg-paper-2 dark:bg-paper-3 border border-line rounded-xl px-3.5 py-2 text-xs sm:text-sm text-ink placeholder:text-ink-faint/80 focus:outline-none transition-colors shadow-sm"
                />
              </div>

              {/* Database Name (if applicable) */}
              {currentOption.hasUserAndDb && (
                <div>
                  <label className="block text-xs font-semibold text-ink-muted mb-1.5">初始数据库名称 (Database Name)</label>
                  <input
                    type="text"
                    name="db_database_name"
                    id="db_database_name"
                    autoComplete="off"
                    data-1p-ignore="true"
                    data-lpignore="true"
                    data-bwignore="true"
                    data-protonpass-ignore="true"
                    value={dbName}
                    onChange={(e) => setDbName(e.target.value)}
                    placeholder="例如 app_db"
                    autoCapitalize="off"
                    autoCorrect="off"
                    spellCheck={false}
                    className="w-full min-h-[44px] bg-paper-2 dark:bg-paper-3 border border-line rounded-xl px-3.5 py-2 text-xs sm:text-sm text-ink placeholder:text-ink-faint/80 focus:outline-none transition-colors shadow-sm"
                  />
                </div>
              )}

              {/* Database User (if applicable) */}
              {currentOption.hasUserAndDb && (
                <div>
                  <label className="block text-xs font-semibold text-ink-muted mb-1.5">数据库用户名 (Database User)</label>
                  <input
                    type="text"
                    name="db_username"
                    id="db_username"
                    autoComplete="off"
                    data-1p-ignore="true"
                    data-lpignore="true"
                    data-bwignore="true"
                    data-protonpass-ignore="true"
                    value={dbUser}
                    onChange={(e) => setDbUser(e.target.value)}
                    placeholder={`默认 ${currentOption.defaultUser}`}
                    autoCapitalize="off"
                    autoCorrect="off"
                    spellCheck={false}
                    className="w-full min-h-[44px] bg-paper-2 dark:bg-paper-3 border border-line rounded-xl px-3.5 py-2 text-xs sm:text-sm text-ink placeholder:text-ink-faint/80 focus:outline-none transition-colors shadow-sm"
                  />
                </div>
              )}

              {/* Database Password */}
              <div>
                <label className="block text-xs font-semibold text-ink-muted mb-1.5">数据库密码 (Database Password)</label>
                <div className="relative flex items-center">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="db_password"
                    id="db_password"
                    autoComplete="new-password"
                    data-1p-ignore="true"
                    data-lpignore="true"
                    data-bwignore="true"
                    data-protonpass-ignore="true"
                    value={dbPassword}
                    onChange={(e) => setDbPassword(e.target.value)}
                    placeholder="请输入或点击右侧生成密码"
                    className="w-full min-h-[44px] bg-paper-2 dark:bg-paper-3 border border-line rounded-xl pl-3.5 pr-20 py-2 text-xs sm:text-sm text-ink font-mono placeholder:text-ink-faint/80 focus:outline-none transition-colors shadow-sm"
                  />
                  <div className="absolute right-2 flex items-center gap-1 text-ink-muted">
                    <button
                      type="button"
                      onClick={handleGeneratePassword}
                      className="min-w-[36px] min-h-[36px] p-2 hover:text-ink hover:bg-paper-4 rounded-lg transition-colors cursor-pointer flex items-center justify-center"
                      title="重新随机生成安全密码"
                      aria-label="生成随机密码"
                    >
                      <ArrowsClockwise className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="min-w-[36px] min-h-[36px] p-2 hover:text-ink hover:bg-paper-4 rounded-lg transition-colors cursor-pointer flex items-center justify-center"
                      title={showPassword ? '隐藏密码' : '显示密码'}
                      aria-label={showPassword ? '隐藏密码' : '显示密码'}
                    >
                      {showPassword ? <EyeSlash className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Database Root password (for MariaDB & MySQL) */}
              {currentOption.hasRootPassword && (
                <div>
                  <label className="block text-xs font-semibold text-ink-muted mb-1.5">Root 管理员密码 (Root Password)</label>
                  <div className="relative flex items-center">
                    <input
                      type={showRootPassword ? 'text' : 'password'}
                      name="db_root_password"
                      id="db_root_password"
                      autoComplete="new-password"
                      data-1p-ignore="true"
                      data-lpignore="true"
                      data-bwignore="true"
                      data-protonpass-ignore="true"
                      value={dbRootPassword}
                      onChange={(e) => setDbRootPassword(e.target.value)}
                      placeholder="请输入或点击右侧生成 Root 密码"
                      className="w-full min-h-[44px] bg-paper-2 dark:bg-paper-3 border border-line rounded-xl pl-3.5 pr-20 py-2 text-xs sm:text-sm text-ink font-mono placeholder:text-ink-faint/80 focus:outline-none transition-colors shadow-sm"
                    />
                    <div className="absolute right-2 flex items-center gap-1 text-ink-muted">
                      <button
                        type="button"
                        onClick={handleGenerateRootPassword}
                        className="min-w-[36px] min-h-[36px] p-2 hover:text-ink hover:bg-paper-4 rounded-lg transition-colors cursor-pointer flex items-center justify-center"
                        title="重新随机生成 Root 密码"
                        aria-label="生成随机 Root 密码"
                      >
                        <ArrowsClockwise className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowRootPassword(!showRootPassword)}
                        className="min-w-[36px] min-h-[36px] p-2 hover:text-ink hover:bg-paper-4 rounded-lg transition-colors cursor-pointer flex items-center justify-center"
                        title={showRootPassword ? '隐藏密码' : '显示密码'}
                        aria-label={showRootPassword ? '隐藏密码' : '显示密码'}
                      >
                        {showRootPassword ? <EyeSlash className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Docker image */}
              <div>
                <label className="block text-xs font-semibold text-ink-muted mb-1.5">Docker 镜像标签 (Docker Image)</label>
                <input
                  type="text"
                  name="db_docker_image"
                  id="db_docker_image"
                  autoComplete="off"
                  data-1p-ignore="true"
                  data-lpignore="true"
                  data-bwignore="true"
                  data-protonpass-ignore="true"
                  value={dockerImage}
                  onChange={(e) => setDockerImage(e.target.value)}
                  placeholder={`默认 ${currentOption.defaultImage}`}
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                  className="w-full min-h-[44px] bg-paper-2 dark:bg-paper-3 border border-line rounded-xl px-3.5 py-2 text-xs sm:text-sm text-ink placeholder:text-ink-faint/80 focus:outline-none font-mono transition-colors shadow-sm"
                />
              </div>
            </div>
          </div>

          {/* Sticky Bottom Action Bar: Mobile Sticky Full-Width / Desktop Dual Buttons */}
          <div className="sticky bottom-0 z-10 bg-paper sm:bg-paper-2 px-6 py-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] flex items-center justify-between sm:justify-end gap-3 shrink-0">
            {/* Desktop Cancel Button */}
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="btn-vessel-secondary hidden sm:inline-flex px-4 py-2 text-xs font-medium rounded-xl cursor-pointer"
            >
              取消
            </button>

            {/* Main Submit Button: 100% width on Mobile, Auto width on Desktop */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full sm:w-auto min-h-[44px] sm:min-h-[36px] px-6 py-2.5 sm:py-2 btn-vessel-primary text-sm sm:text-xs font-semibold rounded-xl flex items-center justify-center gap-2 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <CircleNotch className="w-4 h-4 animate-spin" />
                  <span>创建中...</span>
                </>
              ) : (
                <span>创建数据库</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};
