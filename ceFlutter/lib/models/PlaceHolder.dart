import 'dart:math';

Random random = new Random();
int randomNumber = random.nextInt(100); // from 0 upto 99 included

class Funnies {
   final List<String> funnies = [
      "Give people more than they expect and do it cheerfully.",
      "Memorize your favorite poem.",
      "Don't believe all you hear, spend all you have, or loaf all you want.",
      "When you say, \"I love you,\" mean it.",
      "When you say, \"I'm sorry,\" look the person in the eye.",
      "Love deeply and passionately. You may get hurt, but it's the only way to live life completely.",
      "Don't judge people by their relatives, or by the life they were born into.",
      "Teach yourself to speak slowly but think quickly.",
      "Great love and great achievement involve great risk.",
      "When you lose, don't lose the lesson.",
      "Follow the three Rs: Respect for self, Respect for others, Responsibility for all your actions.",
      "Don't let a little dispute injure a great friendship.",
      "When you realize you've made a mistake, take immediate steps to correct it.  You'll sleep better.",
      "Spend some time alone.",
      "Spend some time with people.",
      "Open your arms to change, but don't let go of your values.",
      "Silence is sometimes the best answer.",
      "Live a good, honorable life. When you get older and think back, you'll be able to enjoy it a second time.",
      "A loving atmosphere in your home is the foundation for your life.",
      "Don't just listen to what someone is saying. Listen to why they are saying it.",
      "Share your knowledge. Achieve immortality.",
      "Be gentle with the earth.",
      "Mind your own business.",
      "Once a year, go someplace you've never been before.",
      "Wealth's greatest satisfaction is putting it to use helping others while you are living.", 
      "Not getting what you want is sometimes a wonderful stroke of luck.",
      "Learn the rules so you know how to break them properly.",
      "The best relationship is one in which your love for each other exceeds your need for each other.",
      "Approach love and cooking with reckless abandon.",
      "Work like you don't need money, Love like you've never been hurt, and dance like no one's watching.",
      "Many people will walk in and out of your life, but only true friends will leave footprints in your heart",
      "Yesterday is history, Tomorrow a mystery, Today a gift.",
      "Time flies; but remember you are the navigator",
      "Happiness is like a kiss--In order to get any good out of it, you have to give it to somebody else",
      "Happiness is found along the way--not at the end of the road.",
      "There is no pot of gold at the end of the rainbow, it is all about the journey.",
      "That's not for today.",
      "Run one lap around the office at top speed.",
      "Groan out loud in the bathroom cubicle (at least one other non-player' must be in the bathroom at the time).",
      "Phone someone in the office you barely know, leave your name and say \"Just called to say I can't talk right now. Bye\".",
      "Walk sideways through the hotel lobby.",
      "While riding an elevator, gasp dramatically every time the doors open.",
      "Babble incoherently at a fellow employee then ask \"Did you get all that, I don't want to have to repeat it\".",
      "At the end of a meeting, suggest that, for once, it would be nice  to conclude with the singing of the Village People's Y.M.C.A.",
      "For an hour, refer to everyone you speak to as \"Bob\".",
      "On a colleague's postit-note, write in 10am: \"See how I look in tights\".",
      "ADULT: A person who has stopped growing at both ends and is now growing in the middle.",
      "CANNIBAL: Someone who is fed up with people.",
      "CHICKENS: The only creatures you eat before they are born and after they are dead.",
      "COMMITTEE: A body that keeps minutes and wastes hours.",
      "DUST: Mud with the juice squeezed out.",
      "EGOTIST: Someone who is usually me-deep in conversation.",
      "GOSSIP: A person who will never tell a lie if the truth will do more damage.",
      "HANDKERCHIEF: Cold Storage.",
      "INFLATION: Cutting money in half without damaging the paper.",
      "MOSQUITO: An insect that makes you like flies better.",
      "RAISIN: Grape with a sunburn.",
      "SECRET: Something you tell to one person at a time.",
      "TOOTHACHE: The pain that drives you to extraction.",
      "TOMORROW: One of the greatest labor saving devices of today.",
      "YAWN: An honest opinion openly expressed.",
      "WRINKLES: Something other people have. You have character lines.",
      "From a Southwest Airlines employee: \"There may be 50 ways to leave your lover, but there are only 4 ways out of this airplane.\"",
      "\"Your seat cushions can be used for flotation. In the event of an emergency water landing, please take them with our compliments.\"",
      "\"Last one off the plane must clean it.\""
      "Q. Why do computer geeks confuse Halloween with Christmas?  A. Because Oct 31 = Dec 25",
      "A lady placed an ad in the classifieds: \"Husband wanted.\" The next day she received a hundred letters. They all said the same thing: \"You can have mine!.\"",
      "Butterflies taste with their feet.",
      "A duck's quack doesn't echo, and no one knows why.",
      "In 10 minutes, a hurricane releases more energy than all of  the world's nuclear weapons combined.",
      "Elephants are the only animals that can't jump.",
      "It's possible to lead a cow upstairs ... but not downstairs.",
      "It's physically impossible for you to lick your elbow.",
      "A snail can sleep for three years..",
      "No word in the English language rhymes with \"MONTH.\"",
      "Our eyes are always the same size from birth, but our nose and ears never stop growing.",
      "An ostrich's eye is bigger than its brain.",
      "TYPEWRITER is the longest word that can be made using the letters only on one row of the keyboard.",
      "\"Go,\" is the shortest complete sentence in the English language.",
      "In the memo field of all your checks, write \"for smuggling diamonds.\"",
      "Finish all your sentences with \"in accordance with the prophecy.\"",
      "As often as possible, skip rather than walk.",
      "Order diet water with a serious face whenever you go out to eat.",
      "Specify that your drive-through order is \"to go.\"",
      "When the money comes out the ATM, scream \"I won! I won!\"",
      "I cdnuolt blveiee taht I cluod aulaclty uesdnatnrd waht I was rdanieg. The phaonmneal pweor of the hmuan mnid, aoccdrnig to a rscheearch at Cmabrigde Uinervtisy, it deosn't mttaer in waht oredr the ltteers in a wrod are, the olny iprmoatnt tihng is taht the frist and lsat ltteer be in the rghit pclae. The rset can be a taotl mses and you can sitll raed it wouthit a porbelm. Tihs is bcuseae the huamn mnid deos not raed ervey lteter by istlef, but the wrod as a wlohe. Amzanig huh? yaeh and I awlyas tghuhot slpeling was ipmorantt!"
      ];

   Funnies();

   String getOne() {
      
      Random random = new Random();
      int rn = random.nextInt( funnies.length );

      return funnies[rn];
   }

}


/*
      "An elderly man in Phoenix calls his son in New York and says, \"I hate to ruin your day, but I have to tell you that
      your mother and I are divorcing; forty-five years of misery is enough.\"
      \"Pop, what are you talking about?\" the son cries.
      \"We can't stand the sight of each other any longer,\" the old man says. \"We're sick of each other, and I'm sick of talking about this,
      so call your sister in Chicago and tell her," and he hangs up.\"
      Frantic, the son calls his sister, who explodes on the phone. \"Like heck they're getting divorced,\" she shouts, \"I'll take care of this.\"
She calls Phoenix immediately, and screams at the old man,"\You are NOT getting divorced.  Don't do a single thing until I get there.
I'm calling my brother back, and we'll both be there tomorrow. Until then, don't do a thing, DO YOU HEAR ME?\" and hangs up.
\n
The old man hangs up his phone, too, and turns to his wife. \"Okay,\" he says, \"they're coming for Thanksgiving. Now what do we tell them for Christmas?\"
\n
Live well, Laugh often, Love lots.",


      "\"As you exit the plane, please make sure to gather all of your belongings. Anything left behind will be distributed evenly among
      the flight attendants. Please do not leave children or spouses.\"",

      "A little boy was doing his math homework. He said to himself, \"Two plus five, that son of
      a bitch is seven. Three plus six, that son of a bitch is nine....\" His mother heard what he was saying and gasped, \"What are you doing?\"
The little boy answered, \"I'm doing my math homework, Mom.\" \"And this is how your teacher taught you to do it?\" the mother asked.
\"Yes,\" he answered.  Infuriated, the mother asked the teacher the next day, \"What are you teaching my son in
math?\" The teacher replied, \"Right now, we are learning addition.\" The mother asked, \"And are you teaching them to say two plus two, that
son of a bitch is four?\"  After the teacher stopped laughing, she answered, \"What I taught them was, two plus
two, THE SUM OF WHICH, is four.\""


      "1. How do you put a giraffe into a refrigerator? 
      \n 
      The correct answer is:  Open the refrigerator put in the giraffe and close the door.  This question tests whether you tend to do simple
                                                                                                                                          things in an overly complicated way. 
                                                                                                                                          \n 
                                                                                                                                          2. How do you put an elephant into a refrigerator? 
                                                                                                                                                       \n
                                                                                                                                                       Open the refrigerator put in the elephant and close  the door. 
                                                                                                                                                       Wrong Answer! 
                                                                                                                                                       \n
 Correct Answer:  Open the refrigerator, take out the  giraffe, put in the elephant and close the door. 
 This tests your ability to think through the  repercussions of your previous actions. 
 \n
 3. The Lion King is hosting an animal conference.  All the animals attend except one. Which animal does not attend? 
 \n
 Correct Answer:  The Elephant.  The elephant is in the  refrigerator.  This tests your memory. 
 \n
 OK, even if you did not answer the first three questions correctly,  you still have one more chance to show your true abilities. 
 \n
 4. There is a river you must cross.  But it is inhabited by crocodiles.  How do you manage it? 
 \n
 Correct Answer:  You swim across.  All the crocodiles are attending the animal meeting.  This tests whether you learn quickly from your previous mistakes. 
" 

      "A father and son went hunting together for the first time. The father said, \"Stay here and be very QUIET. I'll be across the field.\"
      A short time later, the father heard a  bloodcurdling scream and ran back to his son.  \"What's wrong?\" the father asked. \"I told you to  be quiet.\"
The son answered, \"Look, I was quiet when the snake slithered across my feet.
I was quiet when the bear breathed down my neck. I didn't move a muscle when the skunk climbed over my shoulder.
I closed my eyes and held my breath when the wasp stung me.
I didn't cough when I swallowed the gnat.
I didn't cuss or scratch when the poison oak started itching.
But when the two chipmunks crawled up my pant legs and said, \"Should we eat them here or take them with us?\"
Well, I guess I just panicked.\""

      "Pilot: \"Folks, we have reached our cruising altitude now, so I am going to switch the seat belt sign off. Feel free to move about as
      you wish, but please stay inside the plane till we land. It's a bit cold outside, and if you walk on the wings it affects the flight pattern.\"",
      "As the plane landed and was coming to a stop at Washington National, a lone voice came over the loudspeaker: \"Whoa, big fella. Whoa!\"",
      "After a particularly rough landing during thunderstorms in Memphis, a flight attendant on a Northwest flight announced:
      \"Please take care when opening the overhead compartments because, after a landing like that, sure as hell everything has shifted.\"",
      "From a Southwest Airlines employee: \"Welcome aboard Southwest. To operate your seatbelt, insert the metal tab
      into the buckle, and pull tight. It works just like every other seatbelt and if you don't know how to operate one, you
      probably shouldn't be out in public unsupervised. In the event of a sudden loss of cabin pressure, oxygen masks will
      descend from the ceiling. Stop screaming, grab the mask, and pull it over your face.\"",


      "\"Weather at our destination is 50 degrees with some broken clouds, but they'll try to have them fixed before we arrive. Thank you, 
      and remember, nobody loves you or your money more than Southwest Airlines.\"",

      "From the pilot during his welcome message: \"We are pleased to have some of the best flight attendants in the industry. Unfortunately
      none of them are on this flight.\"",

      "After a real crusher of a landing in Phoenix, the flight attendant got on the PA and said, \"Ladies and gentlemen, please remain in
      your seats until Captain Crash and the crew have brought the aircraft to a screeching halt up against the gate. And, once the tire smoke has
      cleared and the warning bells are silenced, we'll open the door and you can pick your way through the wreckage to the terminal.\"",
      "Part of a flight attendant's arrival announcement: \"We'd like to thank you folks for flying with us today. And, the next time you get
      the insane urge to go blasting through the skies in a pressurized metal tube, we hope you'll think of us here at US Airways.\"",


      "Abraham Lincoln was elected to Congress in 1846.
      John F. Kennedy was elected to Congress in 1946.
      Abraham Lincoln was elected President in 1860.
      John F. Kennedy was elected President in 1960.
      Both were particularly concerned with civil rights.
      Both wives lost their children while living in the White House.
      Both Presidents were shot on a Friday.
      Both Presidents were shot in the head.
      Lincoln's secretary was named Kennedy.
      Kennedy's Secretary was named Lincoln.
      Both were assassinated by Southerners.
      Both were succeeded by Southerners named Johnson.
      Andrew Johnson, who succeeded Lincoln, was born in 1808.
      Lyndon Johnson, who succeeded Kennedy, was born in 1908.
      John Wilkes Booth, who assassinated Lincoln, was born in 1839.
      Lee Harvey Oswald, who assassinated Kennedy, was born in 1939.
      Both assassins were known by their three names.
      Both names are composed of fifteen letters.
      Lincoln was shot at the theater named 'Ford'.
      Kennedy was shot in a car called 'Lincoln' made by 'Ford'.
      Booth and Oswald were assassinated before their trials.
      A week before Lincoln was shot, he was in Monroe, Maryland
      A week before Kennedy was shot, he was with Marilyn Monroe.",
      
*/
