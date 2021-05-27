<br>
**DOC IN PROGRESS...**
<br>
**DOC IN PROGRESS...**
<br>
**DOC IN PROGRESS...**

# CodeEquity Software Manual

CodeEquity is based on a simple truth: ***If you help create something, you should
be among those that benefit from it***.

Traditional established companies pay employee salaries, promise stability, and provide many perks
including insurance, retirement plans, office space, computing environments, lots of free coffee and
more.  In return, those companies own all of the output of every one of their employees.  Startup
companies are similar, but in place of stability, retirement plans, and often competitive wages,
they offer small amounts of equity in order to attract skilled employees.

There are other models for organizing teams to create products.  GitHub provides a space for the
primary alternative today in the software development world.  Most new ventures in the GitHub space do not
offer money to compensate skilled contributors.  Nor do they offer office space, insurance,
retirement plans, or lots of free coffee.  Instead, they offer social recognition and a sense of
purpose.  These incentives can be powerful, but only up to a point. 

CodeEquity proposes that these new ventures additionally offer up their primary currency,
***ownership***, as the key incentive to attract skilled contributors.  CodeEquity is both a legal
framework, and a software framework, that makes this simple idea easy to put into practice, and
iron-clad should the venture become successful down the road.

In the big picture, CodeEquity is an attack on the greatest remaining barrier to large scale
technical innovation: the human factor.  Up until now, the necessary ingredients before a new
venture can take off are: lots of money; some luck; and a good idea.  The money has been needed for
all of the trappings of a traditional company, including office space, computing environments and
wages.  This equation has changed over the last decade, with the advent of dependable internet,
cloud-based compute services, code and project management.  All that's left is the human factor: How
do you attract several person-years of skilled, dedicated help without the money to pay wages?  We
believe fully sharing equity is the only answer that has a chance to reshape or destroy this final
blocker to full merit-based technical innovation.

How much more dynamic, inventive and sizeable would the GitHub community be if contributors saw the
potential, however slight, of making a living or better by contributing to a project?

For the *potential contributor* the choice is clear.  All else being equal between two projects of
equal merit, one of which is a CodeEquity project, and one which is not, why contribute to the
project that does not share equity?

For the *founders*, the choice is easy as well.  Most new ventures find it hard to attract skilled
contributors.  Is there a more powerful way to attract them than by offering equity?  Yes, it will
reduce the equity you can retain personally, but the equity you do retain has a much higher chance
of being worth something down the road if you can get good help early on.

For the potential contributor to CodeEquity software itself, well, yes, we are a CodeEquity project,
so consider joining the team!

The remainder of this document focuses on the software infrastructure, exclusively.


## CodeEquity Key Concepts

Equity in a CodeEquity project is earned by making contributions to that project.  In a typical
company, equity is granted to a person privately on an annual basis based on the subjective
evaluation of that person's boss.  In contrast, equity in a CodeEquity project can be earned at any point during
the year.  The equity value of any contribution is known to all, up front, and the accrual of equity
is both objective and public.

Note that below, several common CodeEquity terms and concepts are introduced, primarily to help make
the manual concise and understandable.  These introductions are for common reference only.  For
binding definitions and details, refer to the **CodeEquity Venture Equity Agreement**.


### Provisional Equity (PEQ)

In point of fact, *equity* is not earned in CodeEquity Ventures, but rather *provisional equity* is.
Equity in a company requires the company to exist a legal entity such as an LLC or a Corporation.  This
is not a realistic step for most early ventures, since it takes time and money to set up.  

Provisional equity are normal stock options, provisional on the venture being converted into a legal
business entity.  The CodeEquity promise, secured by the CodeEquity legal framework, is that every
share of provisional equity owned by a contributor will be converted 1:1 to a stock option in any
company created from the venture.  Furthermore, any revenue gained by a CodeEquity Venture (for
example, with the sale of related intellectual property) that is not fed back into the venture will
be split among contributors according to how many shares of Provisional Equity they have.

For binding definitions and details, refer to **Provisional Stock Options** in the **CodeEquity Venture Equity Agreement**.  
For simplicity of reference throughout CodeEquity, one provisional stock option is denoted as *1 PEQ*,
or *one share of provisional equity*.


### CodeEquity Ventures & Projects

A CodeEquity Venture is analogous to a company.  A CodeEquity Project is analogous to a project, or
part of a project within a company.

For example, Jessie has a great idea for an app that allows people within a community to browse,
borrow and loan books with each-other, and has decided to pursue this idea within the CodeEquity
framework.  Jessie is calling the app "BookShare".  To simplify planning, Jessie is breaking the app
development into several projects: *BookShare frontend*, *BookShare backend*, and *BookShare
operations*.  In this example, the CodeEquity Venture is BookShare.  The Venture is made up of three
CodeEquity Projects: *BookShare frontend*, *BookShare backend*, and *BookShare operations*.
CodeEquity will track and collate provisional equity across the three projects and report it within
the umbrella of the Venture: BookShare.

### PEQ Issues

A CodeEquity Project will typically be planned and tracked with a collection of *issues* managed 
with project management software.  For example, see the GitHub project boards below.  Common issues
involve planned features, feature requests, and bug reports.

A PEQ issue is any issue that has a PEQ value attached to it.  For example, the BookShare frontend
project might have an issue: "Add book detail page".  Without an associated PEQ value, this is not a
PEQ issue.  Once Jessie adds, say, a "1000 PEQ" label to the issue, it becomes a PEQ issue and will
be subsequently tracked by CodeEquity software.


### CodeEquity Software Framework Mandate

All elements of CodeEquity's software exist to aid in tracking and managing the provisional equity
associated with a CodeEquity Venture.  This responsibility lasts up until when the Venture converts
to a legal corporate entity and the provision shares are converted to stock options in that new
entity, at which point the new legal entity takes over.

To support this mandate, CodeEquity software tracks and stores every action that impacts the
resolution of an issue with attached PEQs.  Likewise, CodeEquity is free to ignore every action that
has no impact on the resolution of an issue with attached PEQs.  For example, CodeEquity tracks
operations like adding a PEQ label to an issue, closing a PEQ issue, or changing who is assigned to
a PEQ issue.  For example, CodeEquity ignores operations like creating an issue that does not have a
PEQ label, adding a comment to an issue, or changing the name of a project column that does not have
associated PEQ issues.

Additionally, CodeEquity software ensures that once PEQs have accrued (i.e. provisional equity has
been earned by a contributor), all characteristics of those PEQs are immutable.  For example, if
Alex earned 1000 PEQs for implementing a new feature for BookShare, they can not be taken away or
changed down the road.



# CodeEquity for GitHub

CodeEquity works with GitHub through
[project boards](https://docs.github.com/en/github/managing-your-work-on-github/managing-project-boards/about-project-boards),
which is a Kanban-style project management
tool.  GitHub's project boards are a great way to track the lifecycle of all the issues related to a
project throughout the duration of the project.
They are quick to learn, and functional enough to easily support small to medium sized projects and
teams.  GitHub has integrated their project boards with all core elements of its repository
management toolkit, and provides a push-based notification system based on REST for external
application integration.  CodeEquity utilizes this notification system along with GitHub's Octokit
developer API to build a wrapper around any Github project board, converting it into a CodeEquity
Project.

The image below shows a typical GitHub project.  This project is for "LUCI", and is composed of three
columns and a handful of cards that are linked to issues.  One issue can be linked to multiple cards
in GitHub.  Cards and issues can exist independently of one another, however, when they are linked,
all related information is stored with the issue.  GitHub uses labels with issues to help manage the
attention of the project's collaborators.  For example, common labels deal with feature requests,
bugs, severity, and so on.  Issues contain a history of comments, can be assigned to collaborators,
they can be opened, closed, transfered and edited.  A GitHub repository can have any number of
projects associated with it.


<p float="left">
  <img src="githubProject.png" height="480"  />
</p>

<br>

This next image shows a typical CodeEquity project in GitHub.  There are a handful of key
differences that can be seen here.


<p float="left">
  <img src="codeEquityProject.png" height="320"  />
</p>

<br>

CodeEquity adds two new types of labels, called PEQ (or Provisional EQuity) labels.  For example,
the *Close open test* card in the **Accrued** column has the label ***1000 PEQ***.  This label
informs CE Server that the *Close Open test* card, or rather the issue linked to it, is valued at
1000 shares of provisional equity.  In contrast, an AllocPEQ label such as ***200,000 AllocPEQ***
indicates that the task described in the related card has been allocated 200,000 PEQs for planning,
but has not yet been fully tasked out.  There can only be one PEQ label per issue.

CodeEquity projects also have two reserved columns: **Pending PEQ Approval** and **Accrued**.  When
a card moves to the **Pending PEQ Approval** column, it serves as a signal to CE Server that the
underlying issue is completely resolved.  When the card enters **Pending PEQ Approval**, it also
serves as a request to the whomever has approval authority on the project, to confirm that the issue
has been resolved in a satisfactory way.  The approver confirms by moving the card
into the **Accrued** column.  The act of moving a card into the
**Accrued** column is an explicit acknowledgement to the team, and to CodeEquity, that the
assignee(s) on the issue have just accrued the PEQs related to that issue.  For example, when *IR
Pending* moves to the **Accrued** column, one thousand PEQs will accrue and be evenly distributed to
the two assignees on the issue.

The final significant difference between a normal GitHub project, and a CodeEquity project, is that
CE Server enforces a one to one mapping from issues to cards in a CodeEquity project.  Otherwise, if
one issue has multiple cards, there is no clean and simple way to determine how and when the
associated PEQs should accrue.  CE Server enforces this mapping by force-duplicating the issue
every time a user attempts to add an issue to a second project column.

There are other differences as well, mainly to ensure that a CodeEquity project stays in a valid state.
These differences are smaller in scope, and are introduced below.  



# CodeEquity Architecture

CodeEquity is composed of the following major components:

<p float="left">
  <img src="backendArch.png" />
</p>

<br>


* **CodeEquity GitHub App**.  A GitHub app that converts projects in a GitHub repository into CodeEquity projects.
* **CE Flutter**.  A multi-platform front end for managing CodeEquity projects.
* **CE Server**.  A Node.js Express server that handles requests from the CodeEquity GitHub App and
                  CE Flutter, and manages all related modifications to provisional equity.  
* **AWS Backend**.  A serverless backend for CE Server responsible for storing and supplying all data
                and updates related to provisional equity.

A brief review of each component follows.  Please see the CodeEquity manual for a more in-depth description.

## CodeEquity App for GitHub

The CodeEquity App for GitHub is (XXX or will be) available in the GitHub Marketplace.  The CodeEquity
App connects a user's GitHub repository to CE Server, by means of the GitHub notification system.
Once installed, any 
[project](https://docs.github.com/en/github/managing-your-work-on-github/managing-project-boards/about-project-boards)
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
[awsDynamo](ops/aws/lambdaHandlers/awsDynamo.js) contains the key lambda handlers for the backend.
Their primary function is saving and retrieving data from a collection of AWS DynamoDB tables.

All communication with the AWS Backend is encoded as JSON REST data.

# CodeEquity QuickStart

## Developer
## Founder
## Collaborator

