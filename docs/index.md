---
title: Welcome to Sindie
layout: base.html
---
# {{ title }}

Sindie 👸 stands for `Small Indieweb Static SIte` and is a configuration-free minimalistic static-site generator, inspired by [eleventy](https://11ty.dev), but for an even more minimalistic approach.

It has zero node-modules dependencies.

This is a silly but serious experiment by [Lea](https://lea.lgbt/@lea) about how far we can get with dependency-free node.js.

This must be how [Zach](https://zachleat.com/@zachleat) started Eleventy ☺️🎈.

## What does it include?

- Configuration API similar to Eleventy
- some Plugin Compatibility with Eleventy
- a basic templating engine with Markdown and HTML
- a Development server with watch mode

## Why? Is it here to compete with Eleventy?

Nope. Eleventy is awesome and I am a proud [supporter](https://opencollective.com/lea-rosema).

I want to get a basic understanding about static site generators and want to evaluate if the complexity could be reduced further. That does come with the cost of flexibility and cut of features.

Also, I suffer from npm fatigue, so I want that node_modules folder to shrink.

But there's one important thing to keep in mind: Right now, the smaller size doesn't necessarily mean it will always run faster compared to Eleventy (it depends!).

Some portions, especially the template expression evaluation can be optimized, eg. by adding a caching mechanism.
