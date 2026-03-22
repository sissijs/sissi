# Sindie

Sindie 👸 stands for `Small Indieweb Static SIte` and is a configuration-free minimalistic static-site generator, inspired by [eleventy](https://11ty.dev), but for an even more minimalistic approach.

This is a silly but serious experiment by [Lea](https://lea.lgbt/@lea) about how far we can get with dependency-free node.js. This must be how [Zach](https://zachleat.com/@zachleat) started Eleventy ☺️🎈.

What does it include?

## Configuration API similar to Eleventy

```js
export default function(config) {
  // You can add plugins via config.addPlugin here
  // config.addPlugin(html);

  return {
    dir: {
      input: 'demo',
      output: 'dist'
    }
  }
}
```

## HTML-includes

It comes with a very basic but effective include system, inspired by Max Böcks [zero-build](https://mxb.dev/blog/buildless/) approach:

```html
<html-include src="header.html"/>
```

## CSS Imports

```css
@import 'variables.css';
@import 'layout.css';
```

## What about JS?

Not sure yet :D.

There is an extension system. You could use that to add esbuild support. That part is compatible with eleventy.
Also, You could totally replace the above CSS processor with LightningCSS, for example.

## The Demo

```sh
npm run dev
```

## Configuration

- You can add plugins via config.addPlugin to add further functionality to Sissy

### Naming

By default, all files are copied from the input file to the output folder, not changing the name.
You can change this behavior to always create a directory and an index file instead:

```js
export default function(config) {
  config.naming = directoryNaming;
}
```
