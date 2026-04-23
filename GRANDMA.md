**THE CONCEPT**

This is a very smart computer tool that will chat back with you to assist u while ordering from the college cafeteria. BUT there is a twist to this the tool is there to help the cafe make more money it will guide the customers to buy higher priced or higher profit items. It helps the customers ored items based on their moods and the conversation it has with the customer while pushing for the ites that will benfit the cafe. 


**THE GENAI**

The way this works is the computer uses a new tool called **Genrative Artificial Intelligence** or Gen AI this tool acts like a super smart brain where it can answer most of the general questions that you ask it, by using the tool the computer can understand how people are talking to each other and what they are talking so that it can talk to us naturally like a normal human. 

But the problem with this tool is that can often give us made up things especially if there is nothing that is there to give this tool information about our cafe. so that it does not make up stuff for the customers I added a section to the program where i stored the all the information about the Menu Items so that the smart brain can look up the dish and come and give answers based on the menu items and the customers needs such as the allergies or ingredients they do not want in their food etc. 

on small change we did to this program was that we shortened the menu in the routes.ts file so that we do not utilize to many tokens we do we have a seperate menu.txt file with all the menu items prep times and the prices but if we used all the items then it will use too many tokens and we can not access the model anymore for a long period of time, to overcome this we shortedned the menu. this was done to make the model more cost effective as the more tokens that you use teh more costly it becomes. 

Sometime smart brains can also be confused or be tricked so that this doesnt happen i made sure that it will check the messages the customers are sending before it will use them and verfiy if it is harmful or strange or not basically it will be following stricit rules so that we can minimize the ammount of damage to the brain. 

**HOW IT WORKS** 

so this tool will guide the cutomers to add another item when they are ordering something . 
example: 
if the customer has ordered bibimbap it will suggest to get an oreo shake 
<img width="1169" height="654" alt="image" src="https://github.com/user-attachments/assets/b970eedb-90ce-4ff4-bf61-27e16d0959a4" />
it gently suggets items but it does not force them to buy anything.

another feature of this program is that i added things to make it more customer friendly
-it will give suggestion if you do not know what to order 
<img width="2046" height="902" alt="image" src="https://github.com/user-attachments/assets/6ef0b187-8f89-4b1f-85ff-339b74127de3" />
-you can give it your dietary prefrences and it will suggest based on your prefrences 
<img width="2088" height="773" alt="image" src="https://github.com/user-attachments/assets/5f505fef-68a3-4296-9436-1093646386fe" />
- when you order is completed, the program will give you some games and puzzles to play so that the customer stays entertained.
<img width="1600" height="781" alt="image" src="https://github.com/user-attachments/assets/7ebb67b8-1fcf-4468-8cc2-5a2445ee33b5" />
<img width="1600" height="755" alt="image" src="https://github.com/user-attachments/assets/2ca7cb2b-bf3f-47fc-9d5e-86cef2606ce6" />
<img width="1600" height="765" alt="image" src="https://github.com/user-attachments/assets/f6c7fda7-aa63-43f4-8658-ee47dcf8f8d2" />
- There is also a voice feature where you will be able to talk to it, it will listen to you and answer.



**HOW IT WAS BUILT**

-for this to work we need some place for the customers to interact with the computer that place is called the  frontend- so for the frontend we used some website tools like next.js, react, typescript with the help of these tools we were able to edit how the program looks and interacts.
-for the brain of everything i used a tool i mentioned before it is a very powerful AI model called LLaMA this helps us answer all the menu and customer preference related questions. It is good to note that when we seperatly tested this application all our memebers used diffrent apis so sometime we used GROQ other times we used google api key that uses the  GEMINI 2.5 FLASH ai model.
-for this to work we need something that connects the brain and the frontend that something is called the      backend this connection is handled by using the next.js , we also use a tool called turbopack to make sure    the computer responds fast 
- we also used something called Vercel AI SDK so that our program can interact with the customer using the      voice feature.the program uses usechat for the coversations and for the replies.
  

