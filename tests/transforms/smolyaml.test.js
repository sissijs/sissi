import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { smolYAML } from '../../src/transforms/smolyaml.js';

const yamlPlain = `
title: Lea is a Frontend Developer
age: 42
details: Front of the Frontend
fullstack: Do not call me Full Stack Dev, although I can see sharp.
`

const plain = {
  title: 'Lea is a Frontend Developer',
  age: 42,
  details: 'Front of the Frontend',
  fullstack: 'Do not call me Full Stack Dev, although I can see sharp.'
};

const yamlWithJson = `
name: "Lea"
pronouns: ["she", "her"] 
`

const withJson = {
  "name": "Lea",
  "pronouns": [
    "she",
    "her"
  ]
};

const yamlEnumeration = `
- 1
- 1
- 2
- 3
- 5
- 8
- 13
- 21
`

const enumeration = [1, 1, 2, 3, 5, 8, 13, 21];

const yamlNested = `
favoriteColors:
  - red
  - rebeccapurple
  - deepskyblue
`

const nested = {
  "favoriteColors": [
    "red",
    "rebeccapurple",
    "deepskyblue"
  ]
}

const yamlNestedObjectwithArray = `
enemies: 
  - name: Goblin Mage
    hitpoints: 56
    mana: 100
    abilities:
      - Fireball
      - Heal
  - name: Bulky Orc
    hitpoints: 200
    mana: 0
    rage: 2000
    abilities:
      - Smash
      - Thrash
      - Bash
`

const nestedObjectWithArray = {
  "enemies": [
    {
      "name": "Goblin Mage",
      "hitpoints": 56,
      "mana": 100,
      "abilities": [
        "Fireball",
        "Heal"
      ]
    },
    {
      "name": "Bulky Orc",
      "hitpoints": 200,
      "mana": 0,
      "rage": 2000,
      "abilities": [
        "Smash",
        "Thrash",
        "Bash"
      ]
    }
  ]
};

const yamlDOOM = `
welcome:
  to:
    the:
      pyramid:
        of:
          doom: true
      pixel:
        of:
          destiny: true
`

const doom = {
  "welcome": {
    "to": {
      "the": {
        "pyramid": {
          "of": {
            "doom": true
          }
        },
        "pixel": {
          "of": {
            "destiny": true
          }
        }
      }
    }
  }
};

describe('smol YAML', () => {

  it('should parse primitives', () => {
    assert.equal(smolYAML('true'), true);
    assert.equal(smolYAML('false'), false);
    assert.equal(smolYAML('I am a string'), 'I am a string');
    assert.equal(smolYAML('"I am a quoted string with \\"escaped\\" double quotes"'), 'I am a quoted string with "escaped" double quotes');
    assert.equal(smolYAML('42'), 42);
    assert.equal(smolYAML('3.1415'), 3.1415);
    assert.equal(smolYAML('-3.14e2'), -314);
    assert(typeof smolYAML('undefined') === 'undefined');
    assert(Number.isNaN(smolYAML('NaN')));
  })

  it('should parse plain object definitions correctly',  () => {
    assert.deepEqual(smolYAML(yamlPlain), plain);
  });

  it('should parse objects with json correctly', () => {
    assert.deepEqual(smolYAML(yamlWithJson), withJson);
  });
  
  it('should parse enumerations correctly', () => {
    assert.deepEqual(smolYAML(yamlEnumeration), enumeration);
  });

  it('should parse nested YAML correctly', () => {
    assert.deepEqual(smolYAML(yamlNested), nested);
  });

  it('should parse nested YAML (array of objects) correctly', () => {
    assert.deepEqual(smolYAML(yamlNestedObjectwithArray), nestedObjectWithArray);
  });

  it('should parse deeply nested YAML correctly', () => {
    assert.deepEqual(smolYAML(yamlDOOM), doom)
  });

  it('should not crash on trailing key with no value', () => {
    assert.deepEqual(smolYAML('name: Lea\ntags:'), { name: 'Lea', tags: [] });
  });

  it('should skip comment lines', () => {
    assert.deepEqual(smolYAML('# a comment\nname: Lea'), { name: 'Lea' });
    assert.deepEqual(smolYAML('  # indented comment\nname: Lea'), { name: 'Lea' });
  });

  it('should parse hyphenated keys', () => {
    assert.deepEqual(smolYAML('x-forwarded-for: 127.0.0.1'), { 'x-forwarded-for': '127.0.0.1' });
    assert.deepEqual(smolYAML('my-list:\n  - item'), { 'my-list': ['item'] });
  });

  it('should trim trailing whitespace from bare values', () => {
    assert.equal(smolYAML('hello   '), 'hello');
    assert.equal(smolYAML('42   '), 42);
  });

  it('should parse single-quoted strings', () => {
    assert.equal(smolYAML("'hello'"), 'hello');
    assert.equal(smolYAML("'it''s a quote'"), "it's a quote");
    assert.deepEqual(smolYAML("name: 'Lea'"), { name: 'Lea' });
  });
});
