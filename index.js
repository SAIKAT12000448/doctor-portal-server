const express = require('express');
const app = express();
const cors = require('cors')
const{MongoClient, ObjectId}= require('mongodb')
const port = process.env.PORT||5000;
// const jwt = require('jsonwebtoken');

require('dotenv').config();
var admin = require("firebase-admin");

//middleware
app.use(cors());
app.use(express.json());



var serviceAccount = require('./doctors-strange-firebase-adminsdk.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});




const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.lrc63.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });
console.log(uri)


async function verifyToken(req,res,next){
    if(req.headers?.authorization.startsWith('Bearer ')){
        const token = req.headers.authorization.split(' ')[1];

        try{
            const decodedUser = await admin.auth().verifyIdToken(token)
            req.decodedEmail = decodedUser.email;
        }
        catch{

        }
    }
    next();
}


async function run() {
    try{
       const database = client.db("DoctorsPortal");
       const appointmentOptionCollection = database.collection("AvailableOptions")
       const bookingCollection = database.collection("bookingCollection")
       const userCollection = database.collection("userInfo")
       const doctorsCollection = database.collection("doctors")


        app.get('/appointmentOptions',async(req,res)=>{
            const date = req.query.date;
            console.log(date);
            const query={}
            const options  = await appointmentOptionCollection.find(query).toArray();
         

             const bookingQuery = {date : date} 
             console.log(bookingQuery)
             const alreadyBooked = await bookingCollection.find(bookingQuery).toArray();
             console.log(alreadyBooked)
             
             options.forEach(option=>{
                console.log(option.name);
                const optionBooked = alreadyBooked.filter(book=>book.treatmentname===option.name)
                console.log(optionBooked);
                const bookedSlots = optionBooked.map(book => book.slot);
                const remainingSlots = option.slots.filter(slot => !bookedSlots.includes(slot))
                option.slots = remainingSlots;
             })
             
            res.send(options)
        })  




        app.get('/appointmentCollections',async(req,res)=>{
            const query={}
            const speciality = await appointmentOptionCollection.find(query).project({name:1}).toArray();
            res.send(speciality);
        })
        // appointment List for particular user

        app.get("/appointmentList",verifyToken,async(req,res)=>{
            const email = req.query.email;
            // console.log('email',email);
            const decodedEmail = req.decodedEmail;
            // console.log(decodedEmail);
            if (email !== decodedEmail) {
                return res.status(403).send({ message: 'forbidden access' });
            }
             
            const date =  new Date(req.query.date).toLocaleDateString();
            console.log(date);
            const query = {email:email,date:date}
            const options = await bookingCollection.find(query).toArray();
            res.send(options)
        })
       
        


app.post('/bookingmodal',async(req,res)=>{
    const content = req.body;
        const query={
        date: content.date,
        email:content.email,
        treatmentname:content.treatmentname
     }
     const alreadyBooked = await bookingCollection.find(query).toArray();
      
     if(alreadyBooked.length){
        const message = `you already have a booking on ${content.date}`
        return res.send({acknowledged:false,message})
     }
    const result = await bookingCollection.insertOne(content);
    console.log(result);

    res.json(result)
})


app.get('/bookings/:id',async(req,res)=>{
    const id = req.params.id;
    const query = {_id:ObjectId(id)}
    const result = await bookingCollection.findOne(query)
    res.send(result)
})







// save user
app.post('/users',async(req,res)=>{
    const user =  req.body;
    const result = await userCollection.insertOne(user);
    res.json(result);
})


app.get('/users',async(req,res)=>{
    const query={};
    const users = await userCollection.find(query).toArray();
    res.send(users)
})


app.put('/users',async(req,res)=>{
    const user = req.body;
    const filter = { email:user.email };
    const options = { upsert: true };
    const updateDoc={$set:{user}};
    const result = await userCollection.updateOne(filter,updateDoc,options);
    res.send(result);

})




// adding price 
// app.get('/addprice',async(req,res)=>{
//     const filter ={}
//     const options={upsert:true};
//     const updateDoc = {
//            $set:{
//             price:99
//            }
//     }
//     const result = await appointmentOptionCollection.updateMany(filter,updateDoc,options);
//     res.send(result)
// })


// app.get('/jwt',async(req,res)=>{
//     const email = req.query.email;
//     const query = {email:email}
//     const user = await userCollection.findOne(query);
//     console.log(user)
//     if(user){
//         const token = jwt.sign({email},process.env.ACCESS_TOKEN,{expiresIn:'1h'})
//         return res.send({AccessToken:token})
//     }
//     res.status(403).send({AccessToken:''})
// })




app.put('/users/admin',verifyToken,async(req,res)=>{
    const user = req.body;
    console.log("put",req.decodedEmail);
    const requester = req.decodedEmail;
    if(requester){
        
        const requesterAccount =await userCollection.findOne({email:requester})
        console.log(requesterAccount);
        if(requesterAccount.role ==='admin'){
            const filter={email:user.email};
            console.log(filter);
            const updateDoc={$set:{role:'admin'}}
            
            const result = await userCollection.updateOne(filter,updateDoc);
            console.log(result);
            res.send(result)
        }
    }
    else{
        res.status(403).json({message:" you don not have access to make admin"})
    }

  

})

app.put('/users/admin/:id',verifyToken,async(req,res)=>{
   

    const requester = req.decodedEmail;
    if(requester){
    const requesterAccount  = await userCollection.findOne({email:requester})
    if(requesterAccount.role==='admin'){
        const id = req.params.id;
    
        const filter={_id:ObjectId(id)};
        console.log(filter);
        const updateDoc={$set:{role:'admin'}}
        
        const result = await userCollection.updateOne(filter,updateDoc);
        console.log(result);
        res.send(result) 
    }
}
else{

    return res.status(403).send('forbidden')
}

 

})








 app.get('/users/admin/:email',async(req,res)=>{
    const email = req.params.email;
    const filter={email:email}
    const user = await userCollection.findOne(filter)
    res.send({isAdmin:user?.role==='admin'})

 })



app.get('/users/:email',async(req,res)=>{
    const email = req.params.email;
    const query ={email:email};
    const user = await userCollection.findOne(query);
    let isAdmin = false;
    if(user?.role==='admin'){
        isAdmin = true;
    }
   res.json({admin:isAdmin})

})
app.get('/getDoctors',async(req,res)=>{
    const doctors = await doctorsCollection.find({}).toArray();

    res.json(doctors)
})


app.post('/doctors',async(req,res)=>{
    const doctor = req.body;
    const result = await doctorsCollection.insertOne(doctor);
    res.send(result);
})

app.delete('/doctors/:id',async(req,res)=>{
    const id = req.params.id;
    const filter={_id:ObjectId(id)};            
    const result = await doctorsCollection.deleteOne(filter);
    res.send(result)
})




        await client.connect();
        console.log("connected to the database")
    }
    finally{
        // await client.close()
    }
}





app.get('/',(req,res)=>{
    res.send('hello world!');
})

app.listen(port,()=>{
    console.log(`app listening to the port ${port}`);
})

run().catch(console.dir);
