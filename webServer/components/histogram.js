var utils = require('../utils');

// minimalistic histogram.
class Histogram {

    constructor(...elements) {
	this.buckets = [...elements];
	this.buckets.push( 9999 );
	this.times   = new Array( this.buckets.length ).fill(0);
	this.last    = -1;

	this.show();
    }

    purge() {
	this.last = -1;
	this.times = [];
    }

    add( stamp ) {
	if( this.last == -1 ) { this.last = stamp; }
	const mDiff = ( utils.millisDiff( stamp, this.last ) ) / 1000;
	this.last = stamp;

	for( let i = 0; i < this.buckets.length; i++ ) {
	    if( mDiff < this.buckets[i] ) {
		this.times[i]++;
		break;
	    }
	}
    }

    prefill( val, num ) {
	let retVal = "";
	if( typeof val === 'undefined' ) { val = ""; }
	else                             { val = val.toString(); }

	
	let prefix = " ";
	if( val.length >= num ) { retVal = val; }
	else                    { retVal = prefix.repeat( num - val.length ) + val; }

	return retVal;
    }

    show() {
	let header  = "";
	let content = "";

	for( let i = 0; i < this.buckets.length; i++ ) {
	    header  += this.prefill( this.buckets[i], 5 );
	    content += this.prefill( this.times[i], 5 );
	}
	
	console.log( header );
	console.log( content );
    }
}

exports.Histogram = Histogram;
