#!/usr/bin/env python

import sys
import os

# GitHub doesn't support a method to compose multiple files into one .md
# But the README serves a different purpose than the undelying manual, and benefits from pulling in
# sections of the manual.

# Special purpose, create ../README.md from raw-README.md and docs/parts-*
# Special purpose, create ceManual.md from raw-ceManual.md and parts-*

# XXX Could use a little error checking in here....


def compose( inFile, outFile, updir ):
    
    print( "Working on", outFile )

    f       = open( inFile )
    inputs  = f.readlines()
    outputs = []
    f.close()

    # Compose full manual
    for line in inputs:
        startIndex = line.find("<INCLUDE ")
        if( startIndex == -1 ):
            outputs.append( line )
        else:
            stopIndex = line.find(">")

            pfName  = line[9:stopIndex]
            pf      = open( pfName )
            pfLines = pf.readlines()
            pf.close()

            # crufty
            compLines = []
            for pline in pfLines:
                if( updir and pline.find("img src=\"images/backendArch") != -1 ) :
                    compLines.append( '  <img src="docs/images/backendArch.png" />\n' )
                else:
                    compLines.append( pline )

            outputs = outputs + compLines
            
    manual = open( outFile, 'w' )
    manual.writelines(outputs)
    manual.close()


def main():
    compose( "raw-ceManual.md", "ceManual.md", False )
    # compose( "raw-README.md", "../README.md", True )
    compose( "raw-README.md", "README.md", True )
    compose( "raw-ghc-ceManual.md", "ceManual-Classic.md", False )
        

if __name__ == "__main__":
    main()
