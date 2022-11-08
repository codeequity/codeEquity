// var assert = require('assert');


// Fifo
class Queue {

    // let queue = new Queue( "kdjf", "kkdk", "kds" );
    constructor(...elements) { this.elements = [...elements]; }

    push(...args)  { return this.elements.push(...args);  }  // add
    shift(...args) { return this.elements.shift(...args); }  // get 0th
    getAll()       { return this.elements; }
    purge()        { this.elements = []; }

    get length()   { return this.elements.length;         }
    get first()    { return this.elements.length > 0 ? this.elements[0] : -1; }
}

exports.Queue = Queue;
