import * as utils from "../utils/ceUtils.js";

// minimalistic histogram.
class Histogram {

    constructor(div, elements) {
	this.buckets = elements;
	this.buckets.push( elements[ elements.length - 1] * 100 );
	this.times   = new Array( this.buckets.length ).fill(0);
	this.last    = -1;
	this.div     = div;

	// this.show( "" );
    }

    /*
    constructor(...elements) {
	this.buckets = [...elements];
	this.buckets.push( 9999 );
	this.times   = new Array( this.buckets.length ).fill(0);
	this.last    = -1;

	// this.show( "" );
    }
    */
    
    purge() {
	this.last = -1;
	this.times = [];
    }

    add( stamp ) {
	if( this.last == -1 ) { this.last = stamp; }
	const mDiff = ( utils.millisDiff( stamp, this.last ) ) / this.div;
	this.last = stamp;

	for( let i = 0; i < this.buckets.length; i++ ) {
	    if( mDiff < this.buckets[i] ) {
		this.times[i]++;
		break;
	    }
	}
    }

    addDiff( diff ) {
	let mDiff = diff / this.div;
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

    show( title ) {
	let header  = "";
	let content = "";

	console.log( title );
	for( let i = 0; i < this.buckets.length; i++ ) {
	    if( i == this.buckets.length - 1 ) { header += this.prefill( "last", 6 ); }
	    else                               { header  += this.prefill( this.buckets[i], 6 ); }
	    content += this.prefill( this.times[i], 6 );
	}
	
	console.log( header );
	console.log( content );
    }
}

// exports.Histogram = Histogram;
export default Histogram;
