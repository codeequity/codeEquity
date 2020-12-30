// var assert = require('assert');

var utils = require('../utils');
var config  = require('../config');

// Fifo
class Queue {

    // let queue = new Queue( "kdjf", "kkdk", "kds" );
    constructor(...elements) { this.elements = [...elements]; }

    push(...args)  { return this.elements.push(...args);  }  // add
    shift(...args) { return this.elements.shift(...args); }  // get 0th
    get length()   { return this.elements.length;         }

    get first()    { return this.elements.length > 0 ? this.elements[0] : -1; }
}

exports.Queue = Queue;
