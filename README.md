# CodeEquity

For the developer.. <XXX>

For the founder.. <XXX>

For the collaborator.. <XXX>


DOC IN PROGRESS...

### CodeEquity Project
<XXX>

### Provisional Equity (PEQ)
<XXX>

# CodeEquity for GitHub
<XXX>

# CodeEquity Architecture

CodeEquity is composed of the following major components:
* CodeEquity GitHub App.  A GitHub app that converts projects in a GitHub repository into CodeEquity projects.
* CE Flutter.  A multi-platform front end for managing CodeEquity projects.
* CE Server.  A Node.js Express server that handles requests from the CodeEquity GitHub App and CE
              Flutter, and manages all related modifications to provisional equity.
* AWS Backend.  A serverless backend for CE Server responsible for storing and supplying all data
                and updates related to provisional equity.

A brief review of each component follows.  Please see the CodeEquity manual for a more in-depth description.

## CodeEquity App for GitHub

The CodeEquity App for GitHub is (XXX or will be) available in the GitHub Marketplace.  The CodeEquity
App connects a user's GitHub repository to CE Server, by means of the GitHub notification system.
Once installed, any [project]
(https://docs.github.com/en/github/managing-your-work-on-github/managing-project-boards/about-project-boards)
in that repository can be transformed into a CodeEquity project.

The CodeEquity App is actually just a cohesive set of notification requests and permissions that allow
GitHub and CE Server to begin communicating.  As such, the app has no logic or state specific to it.


## CE Flutter

CE Flutter is a Flutter app for desktop and mobile devices that is used to manage CodeEquity
projects.  CE Flutter communicates directly with the AWS backend for provenance related to
provisional equity, collaborator agreements, equity agreements and more. 


## CE Server

CE Server is a Node.js Express server.  CE Server has two primary functions for CodeEquity projects
in a GitHub repository.  First, it records all interactions with provisional equity-related issues,
cards, columns and labels in order to fully track the provenance of all related provisional equity.
Second, CE Server makes changes on behalf of a user in the CodeEquity project in GitHub to ensure
the project remains in a valid state.  CE Server does also manage a small amount of state, which
helps provide a significant speedup to it's GitHub operations.

## AWS Backend
The AWS backend is a serverless architecture on AWS. The architecture is specified with a [yaml
file](ops/aws/samInfrastructure.yaml) that is a mixture of AWS's SAM and CloudFormation
specifications.

Requests from CE Server and CE Flutter are signed with JWT tokens secured from AWS Cognito running
with a user pool.  Signed requests are sent to AWS Lambda functions via AWS Gateway.
[awsDynamo](ops/aws/lambdaHandlers/awsDynamojs) contains the key lambda handlers for the backend.
Their primary function is saving and retrieving data from a collection of AWS DynamoDB tables.

All communication with the AWS Backend is encoded as JSON REST data.

# CodeEquity QuickStart

## Developer
## Founder
## Collaborator


# Status 6/30/21

### CodeEquity App for GitHub Status

Done.

### CE Flutter Status

Pre-Alpha.

### CE Server Status

Pre-Beta.

### AWS Backend Status

Beta.

# Contributing

See the [CONTRIBUTING](CONTRIBUTING.md) file for how to contribute.

# License

See the [LICENSE](LICENSE) file for our project's licensing.

Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.

Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. 





# TODO
* CE app makes project, or repo  codeEquity project or codeEquity repo
* Review ceFlutter, ceServer link
* link CodeEquity Project to definition
* link GitHub app to github expl
* normalize caps
* show dynamo tables?
* Update CE Server location and instantiation once final home is resolved
