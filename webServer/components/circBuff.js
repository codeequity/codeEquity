// var assert = require('assert');

class CircularBuffer {

    // let cb = new CircularBuffer( 50, "kdjf", "kkdk", "kds" );
    constructor( buffCount, ...elements ) {
	this.elements  = [...elements];
	this.buffCount = buffCount;
	this.at        = this.elements.length >= buffCount ? 0 : this.elements.length;

	if( elements.length >= buffCount ) {
	    this.elements  = this.elements.slice( 0, buffCount );
	}
	else if( elements.length < buffCount ) {
	    this.elements = this.elements.concat( new Array( buffCount - elements.length).fill(-1) );
	}
    }

    
    show() {
	// bc: 10.  at:0.  want 9,8,..0
	// bc: 10.  at:7.  want 6,5,..0,9,8,7
	
	console.log( "Circular buffer, buff count:", this.buffCount, ", currently at:", this.at );
	let elts = 1;
	while( elts <= this.buffCount ) {
	    const idx = this.at >= elts ? this.at - elts : this.at + this.buffCount - elts;
	    if( this.elements[idx] == -1 ) { break; }
	    console.log( "  <", idx, "> ", this.elements[ idx ] );
	    elts++;
	}
    }

    getAll()       { return this.elements; }

    // limited to simplify indexing
    push(arg)  {
	this.elements[this.at] = arg;
	this.at = this.at+1 >= this.buffCount ? 0 : this.at + 1;
    }  

    purge()        {
	this.at = 0;
	this.elements = [];
    }

    find(arg) { return this.elements.includes( arg ); }

    fromJson( notes ) {
	this.elements  = notes.elements;
	this.at        = notes.at;
	this.buffCount = notes.buffCount;
    }

}

exports.CircularBuffer = CircularBuffer;
