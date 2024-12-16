require('dotenv').config();
const express = require('express');
const cors = require('cors');
const jwt = require("jsonwebtoken")
const sanitizeHtml = require('sanitize-html');

const app = express();
const port = process.env.PORT || 5000;

const allowedOrigins = [
    'https://portfolio-z-chi.vercel.app',  // Allow this frontend domain
    'http://localhost:5173',  // Add other domains if needed
    'http://localhost:5174',  // Add other domains if needed
    'http://localhost:5000',  // Add other domains if needed
];

app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or Postman)
        if (!origin || allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,  // Allow credentials like cookies or authorization headers
}));
app.options('*', cors());

app.use(express.json());



const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.8vksczm.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();

        const BlogColletion = client.db("PortfolioZ").collection("blog")
        const UserColletion = client.db("PortfolioZ").collection("user")
        const ProjectColletion = client.db("PortfolioZ").collection("project")
        const SkillColletion = client.db("PortfolioZ").collection("skill")
        const TestimonialtColletion = client.db("PortfolioZ").collection("testimonial")
        const ContacttColletion = client.db("PortfolioZ").collection("contact")
        const PortfolioZColletion = client.db("PortfolioZ").collection("portfolio")

        app.post('/jwt', async (req, res) => {
            console.log("Request received at /jwt");
            const { email } = req.body;
            const user = await UserColletion.findOne({ email });
            if (!user) {
                return res.status(404).send({ message: "User not found" });
            }

            const tokenPayload = { email: user.email, role: user.role };
            const token = jwt.sign(tokenPayload, process.env.ACCESS_SECRET_TOKEN, { expiresIn: '1h' });

            console.log("Token generated:", token);
            res.send({ token });
        });

        const verifyToken = (req, res, next) => {
            console.log("Headers received:", req.headers);
            const authHeader = req.headers?.authorization;
            if (!authHeader) {
                return res.status(401).send({ message: 'Authorization header missing' });
            }

            const token = authHeader.split(' ')[1];
            if (!token || token.split('.').length !== 3) {
                return res.status(401).send({ message: 'Invalid token structure' });
            }

            jwt.verify(token, process.env.ACCESS_SECRET_TOKEN, (err, decoded) => {
                if (err) {
                    return res.status(401).send({ message: 'Unauthorized access' });
                }
                req.decoded = decoded;
                next();
            });
        };


        const verifyAdmin = async (req, res, next) => {
            const email = req.decoded.email;
            const user = await UserColletion.findOne({ email });
            if (user?.role !== 'admin') {
                console.log('Admin verification failed for user:', email);
                return res.status(403).send({ message: 'Unauthorized access' });
            }
            next();
        };

        // GET /users
        app.get('/users', verifyToken, async (req, res) => {
            const result = await UserColletion.find({}).toArray();  // Ensure it's an array
            res.send(result);
        });

        // POST /users
        app.post('/users', async (req, res) => {
            const user = req.body;
            const query = { email: user.email };
            const existingUser = await UserColletion.findOne(query);

            if (existingUser) {
                return res.send({ message: "User already exists", insertedId: null });
            }

            const result = await UserColletion.insertOne(user);
            res.send({ message: "User added", insertedId: result.insertedId });
        });

        // DELETE /users/:id
        app.delete('/users/:id', verifyAdmin, verifyToken, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await UserColletion.deleteOne(query);

            if (result.deletedCount === 0) {
                return res.status(404).send({ message: "User not found" });
            }

            res.send({ message: "User deleted", deletedCount: result.deletedCount });
        });

        // projects

        app.get('/projects', async (req, res) => {
            const userEmail = req.query.userEmail; // Retrieve email from query parameter

            if (!userEmail) {
                return res.status(400).send({ message: "User email is required" });
            }

            try {
                const result = await ProjectColletion.find({ userEmail }).toArray(); // Filter projects by user email
                res.send(result);
            } catch (error) {
                console.error("Error fetching projects:", error);
                res.status(500).send({ message: "Error fetching projects" });
            }
        });

        app.get('/projects/:id', async (req, res) => {
            const id = req.params.id;
            if (!ObjectId.isValid(id)) {
                return res.status(400).send({ message: "Invalid project ID" });
            }
            const project = await ProjectColletion.findOne({ _id: new ObjectId(id) });
            if (!project) {
                return res.status(404).send({ message: "Project not found" });
            }
            res.send(project);
        });


        // POST route to add a project associated with the user's email
        app.post('/projects', async (req, res) => {
            const { ProjectName, ProjectDescription, ProjectImage, ProjectLink, userEmail } = req.body;


            if (!ProjectName || !ProjectDescription || !ProjectImage || !ProjectLink) {
                return res.status(400).send({ message: "All fields are required" });
            }

            const projectData = {
                ProjectName,
                ProjectDescription,
                ProjectImage,
                ProjectLink,
                userEmail
            };

            try {
                const result = await ProjectColletion.insertOne(projectData);
                res.status(201).send({ message: "Project added successfully", projectId: result.insertedId });
            } catch (error) {
                console.error("Error adding project:", error);
                res.status(500).send({ message: "Internal Server Error" });
            }
        });



        app.patch('/projects/:id', async (req, res) => {
            const { ProjectName, ProjectDescription, ProjectImage, ProjectLink } = req.body;
            const id = req.params.id;
            const userEmail = req.body.userEmail; // Assuming the user's email is sent in the request body

            if (!ObjectId.isValid(id)) {
                return res.status(400).send({ message: "Invalid project ID" });
            }

            // Fetch the existing project to check if the user is authorized to update it
            const existingProject = await ProjectColletion.findOne({ _id: new ObjectId(id) });

            if (!existingProject) {
                return res.status(404).send({ message: "Project not found" });
            }

            if (existingProject.userEmail !== userEmail) {
                return res.status(403).send({ message: "Unauthorized access" });
            }

            const projectData = {
                ProjectName,
                ProjectDescription,
                ProjectImage,
                ProjectLink,
            };

            try {
                const result = await ProjectColletion.updateOne(
                    { _id: new ObjectId(id) },
                    { $set: projectData }
                );

                if (result.matchedCount > 0) {
                    res.status(200).send({ message: "Project updated successfully" });
                } else {
                    res.status(404).send({ message: "Project not found" });
                }
            } catch (error) {
                console.error("Error updating project:", error);
                res.status(500).send({ message: "Internal Server Error" });
            }
        });




        app.delete('/projects/:id', async (req, res) => {
            const { id } = req.params;
            console.log(id)
            const query = { _id: new ObjectId(id) };
            console.log(query)
            try {
                const result = await ProjectColletion.deleteOne(query);
                if (result.deletedCount > 0) {
                    res.status(200).send({ message: "Project deleted successfully" });
                } else {
                    res.status(404).send({ message: "Project not found" });
                }
            } catch (error) {
                console.error("Error deleting project:", error);
                res.status(500).send({ message: "Internal Server Error" });
            }
        });

        // Skills
        app.get('/skillsicon', async (req, res) => {
            try {
                const { SkillName } = req.query;  // Ensure you're extracting the correct parameter from query
                console.log(SkillName);  // Logs the SkillName query parameter
                if (!SkillName) {
                    return res.status(400).send({ message: "Skill is required" });
                }

                const apiUrl = `https://img.logo.dev/${SkillName.toLowerCase()}.com?token=${process.env.API_KEY}`;
                res.json({ iconUrl: apiUrl });
            } catch (error) {
                console.error("Error fetching skill icon:", error);
                res.status(500).send({ message: "Error fetching skill icon" });
            }
        });



        // app.get('/skillsicon', async (req, res) => {
        //     try {
        //         const skills = await SkillColletion.find().toArray(); // Or however you fetch skills
        //         res.status(200).send({ skills });
        //     } catch (error) {
        //         console.error("Error fetching skills icons:", error);
        //         res.status(500).send({ message: "Error fetching skills icons" });
        //     }
        // });



        app.get('/skills', async (req, res) => {
            const userEmail = req.query.userEmail; // Retrieve email from query parameter
            console.log(userEmail)

            if (!userEmail) {
                return res.status(400).send({ message: "User email is required" });
            }

            try {
                const result = await SkillColletion.find({ userEmail }).toArray(); // Filter skills by user email
                res.send(result);
            } catch (error) {
                console.error("Error fetching skills:", error);
                res.status(500).send({ message: "Error fetching skills" });
            }
        });


        app.get('/skills/:id', async (req, res) => {

            const id = req.params.id;
            if (!ObjectId.isValid(id)) {
                return res.status(400).send({ message: "Invalid Skill ID" });
            }
            const skill = await SkillColletion.findOne({ _id: new ObjectId(id) });
            if (!skill) {
                return res.status(404).send({ message: "Skill not found" });
            }
            res.send(skill);



        });



        app.post('/skills', async (req, res) => {
            const { SkillName, SkillLevel, SkillImage, userEmail } = req.body;


            if (!SkillName || !SkillLevel || !SkillImage || !SkillImage) {
                return res.status(400).send({ message: "All fields are required" });
            }

            const SkillData = {
                SkillName,
                SkillLevel,
                SkillImage,

                userEmail
            };

            try {
                const result = await SkillColletion.insertOne(SkillData);
                res.status(201).send({ message: "Project added successfully", SkilltId: result.insertedId });
            } catch (error) {
                console.error("Error adding project:", error);
                res.status(500).send({ message: "Internal Server Error" });
            }
        });


        app.patch('/skills/:id', async (req, res) => {
            const { SkillName, SkillLevel, SkillImage, userEmail } = req.body;
            const id = req.params.id;

            if (!ObjectId.isValid(id)) {
                return res.status(400).send({ message: "Invalid Skill ID" });
            }

            try {
                // Fetch the existing skill to check if the user is authorized to update it
                const existingSkill = await SkillColletion.findOne({ _id: new ObjectId(id) });

                if (!existingSkill) {
                    return res.status(404).send({ message: "Skill not found" });
                }

                if (existingSkill.userEmail !== userEmail) {
                    return res.status(403).send({ message: "Unauthorized access" });
                }

                // Check if all required fields are present
                if (!SkillName || !SkillLevel || !SkillImage) {
                    return res.status(400).send({ message: "All fields are required" });
                }

                const skillData = {
                    SkillName,
                    SkillLevel,
                    SkillImage,
                    userEmail
                };

                const result = await SkillColletion.updateOne(
                    { _id: new ObjectId(id) },
                    { $set: skillData }
                );

                if (result.matchedCount > 0) {
                    res.status(200).send({ message: "Skill updated successfully" });
                } else {
                    res.status(404).send({ message: "Skill not found" });
                }
            } catch (error) {
                console.error("Error updating skill:", error);
                res.status(500).send({ message: "Internal Server Error" });
            }
        });



        app.delete('/skills/:id', async (req, res) => {
            const { id } = req.params;
            console.log(id)
            const query = { _id: new ObjectId(id) };
            console.log(query)
            try {
                const result = await SkillColletion.deleteOne(query);
                if (result.deletedCount > 0) {
                    res.status(200).send({ message: "Skill deleted successfully" });
                } else {
                    res.status(404).send({ message: "Skill not found" });
                }
            } catch (error) {
                console.error("Error deleting project:", error);
                res.status(500).send({ message: "Internal Server Error" });
            }
        });


        // testimonials 

        app.get('/testimonials', async (req, res) => {
            const userEmail = req.query.userEmail;

            if (!userEmail) {
                return res.status(400).send({ message: "User email is required" });
            }

            try {
                const result = await TestimonialtColletion.find({ userEmail }).toArray();
                res.send(result);
            } catch (error) {
                console.error("Error fetching testimonials:", error);
                res.status(500).send({ message: "Error fetching testimonials" });
            }
        });

        app.get('/testimonials/:id', async (req, res) => {
            const id = req.params.id;
            if (!ObjectId.isValid(id)) {
                return res.status(400).send({ message: "Invalid Testimonial ID" });
            }
            const testimonial = await TestimonialtColletion.findOne({ _id: new ObjectId(id) });
            if (!testimonial) {
                return res.status(404).send({ message: "Testimonial not found" });
            }
            res.send(testimonial);
        });



        app.post('/testimonials', async (req, res) => {
            const { TestimonialpersonName, PersonRole, PersonImage, Testimonial, userEmail } = req.body;

            // Validate that all required fields are provided
            if (!TestimonialpersonName || !PersonRole || !PersonImage || !userEmail || !Testimonial) {
                return res.status(400).send({ message: "All fields are required" });
            }

            // Prepare the testimonial data
            const TestimonialData = {
                TestimonialpersonName,
                Testimonial,
                PersonRole,
                PersonImage,
                userEmail
            };

            try {
                // Insert the testimonial into the MongoDB collection
                const result = await TestimonialtColletion.insertOne(TestimonialData);

                // Send success response
                res.status(201).send({ message: "Testimonial added successfully", TestimonialID: result.insertedId });
            } catch (error) {
                console.error("Error adding testimonial:", error);

                // Send error response with a more detailed message (avoid exposing internal details)
                res.status(500).send({ message: "Internal Server Error. Please try again later." });
            }
        });


        app.patch('/testimonials/:id', async (req, res) => {
            const { TestimonialpersonName, PersonRole, PersonImage, Testimonial, userEmail } = req.body;
            const id = req.params.id;

            if (!ObjectId.isValid(id)) {
                return res.status(400).send({ message: "Invalid Testimonial ID" });
            }

            try {
                const existingTestimonial = await TestimonialtColletion.findOne({ _id: new ObjectId(id) });

                if (!existingTestimonial) {
                    return res.status(404).send({ message: "Testimonial not found" });
                }

                if (existingTestimonial.userEmail !== userEmail) {
                    return res.status(403).send({ message: "Unauthorized access" });
                }

                const updatedTestimonial = { TestimonialpersonName, PersonRole, PersonImage, Testimonial };

                const result = await TestimonialtColletion.updateOne(
                    { _id: new ObjectId(id) },
                    { $set: updatedTestimonial }
                );

                if (result.matchedCount > 0) {
                    res.status(200).send({ message: "Testimonial updated successfully" });
                } else {
                    res.status(404).send({ message: "Testimonial not found" });
                }
            } catch (error) {
                console.error("Error updating testimonial:", error);
                res.status(500).send({ message: "Internal Server Error" });
            }
        });

        app.delete('/testimonials/:id', async (req, res) => {
            const { id } = req.params;
            if (!ObjectId.isValid(id)) {
                return res.status(400).send({ message: "Invalid Testimonial ID" });
            }

            try {
                const result = await TestimonialtColletion.deleteOne({ _id: new ObjectId(id) });
                if (result.deletedCount > 0) {
                    res.status(200).send({ message: "Testimonial deleted successfully" });
                } else {
                    res.status(404).send({ message: "Testimonial not found" });
                }
            } catch (error) {
                console.error("Error deleting testimonial:", error);
                res.status(500).send({ message: "Internal Server Error" });
            }
        });



        // blogs


        app.get('/blogs', async (req, res) => {
            try {
                // Retrieve all blogs from the database
                const blogs = await BlogColletion.find().toArray();

                // Send the list of blogs as a response
                res.status(200).send({ blogs });
            } catch (error) {
                console.error("Error fetching blogs:", error);
                res.status(500).send({ message: "Internal Server Error. Please try again later." });
            }
        });

        // app.get('/blogs/:id', async (req, res) => {
        //     const { id } = req.params;

        //     try {
        //         // Find the blog by its ID
        //         const blog = await BlogColletion.findOne({ _id: new ObjectId(id) });

        //         if (!blog) {
        //             return res.status(404).send({ message: "Blog not found" });
        //         }

        //         // Send the blog as a response
        //         res.status(200).send({ blog });
        //     } catch (error) {
        //         console.error("Error fetching blog:", error);
        //         res.status(500).send({ message: "Internal Server Error. Please try again later." });
        //     }
        // });

        app.get('/blogs/:id', async (req, res) => {
            const { id } = req.params;

            // Check if the provided ID is a valid ObjectId
            if (!ObjectId.isValid(id)) {
                return res.status(400).send({ message: "Invalid Blog ID" });
            }

            try {
                // Find the blog by its ID
                const blog = await BlogColletion.findOne({ _id: new ObjectId(id) });

                if (!blog) {
                    return res.status(404).send({ message: "Blog not found" });
                }

                // Send the blog as a response
                res.status(200).send({ blog });
            } catch (error) {
                console.error("Error fetching blog:", error);
                res.status(500).send({ message: "Internal Server Error. Please try again later." });
            }
        });








        app.post('/blogs', async (req, res) => {
            const { BlogTitle, BlogAuthor, BlogImage, BlogContent, userEmail } = req.body;

            // Validate that all required fields are provided
            if (!BlogTitle || !BlogAuthor || !BlogImage || !BlogContent || !userEmail) {
                return res.status(400).send({ message: "All fields are required" });
            }

            // Prepare the blog data
            const BlogData = {
                BlogTitle,
                BlogAuthor,
                BlogImage,
                BlogContent,
                userEmail,
                createdAt: new Date() // Add timestamp
            };

            try {
                // Insert the blog into the MongoDB collection
                const result = await BlogColletion.insertOne(BlogData);

                // Send success response
                res.status(201).send({ message: "Blog added successfully", BlogID: result.insertedId });
            } catch (error) {
                console.error("Error adding blog:", error);

                // Send error response
                res.status(500).send({ message: "Internal Server Error. Please try again later." });
            }
        });

        app.patch('/blogs/:id', async (req, res) => {
            const id = req.params.id;
            const { BlogTitle, BlogAuthor, BlogImage, BlogContent, userEmail } = req.body;

            // Validate the ObjectId
            if (!ObjectId.isValid(id)) {
                return res.status(400).send({ message: "Invalid Blog ID" });
            }

            if (!userEmail) {
                return res.status(400).send({ message: "User email is required for authorization" });
            }

            try {
                // Check if the blog exists
                const existingBlog = await BlogColletion.findOne({ _id: new ObjectId(id) });

                if (!existingBlog) {
                    return res.status(404).send({ message: "Blog not found" });
                }

                // Authorization: Check if the logged-in user is the owner of the blog
                if (existingBlog.userEmail !== userEmail) {
                    return res.status(403).send({ message: "Unauthorized access" });
                }

                // Prepare the updated blog data
                const updatedBlog = { BlogTitle, BlogAuthor, BlogImage, BlogContent, userEmail };

                // Update the blog
                const result = await BlogColletion.updateOne(
                    { _id: new ObjectId(id) },
                    { $set: updatedBlog }
                );

                if (result.modifiedCount > 0) {
                    return res.status(200).send({
                        message: "Blog updated successfully",
                        updatedBlogId: id, // Include the blog ID in the response
                    });
                } else {
                    return res.status(404).send({ message: "Blog not found" });
                }

            } catch (error) {
                console.error("Error updating blog:", error);
                console.log(error)
                return res.status(500).send({ message: "Internal Server Error" });
            }
        });



        app.delete('/blogs/:id', async (req, res) => {
            const { id } = req.params;

            try {
                // Delete the blog from the collection
                const result = await BlogColletion.deleteOne({ _id: new ObjectId(id) });

                if (result.deletedCount === 0) {
                    return res.status(404).send({ message: "Blog not found" });
                }

                // Send success response
                res.status(200).send({ message: "Blog deleted successfully" });
            } catch (error) {
                console.error("Error deleting blog:", error);
                res.status(500).send({ message: "Internal Server Error. Please try again later." });
            }
        });

        // live link 


        // POST API: Publish Portfolio

        app.post("/publishPortfolio", async (req, res) => {
            try {
                const { email, portfolioData } = req.body;
                console.log("Request received:", req.body);

                // Log incoming request data
                console.log("Received Request:", { email, portfolioData });

                // Validate input
                if (!email) {
                    return res.status(400).json({ message: "Email is required." });
                }
                if (!portfolioData || portfolioData.trim() === "") {
                    return res.status(400).json({ message: "Portfolio data is required." });
                }

                // Sanitize the HTML content
                const sanitizedPortfolioData = sanitizeHtml(portfolioData, {
                    allowedTags: sanitizeHtml.defaults.allowedTags.concat(["img"]),
                    allowedAttributes: {
                        "*": ["href", "src", "alt", "title", "style"],
                    },
                });

                // Log sanitized portfolio data
                console.log("Sanitized Portfolio Data:", sanitizedPortfolioData);

                // Check if the portfolio already exists
                let existingPortfolio = await PortfolioZColletion.findOne({ email });
                if (existingPortfolio) {
                    console.log("Existing portfolio found for:", email);
                    return res.json({ liveLink: existingPortfolio.liveLink });
                }

                // Create a live link
                const liveLink = `https://portfolioz-server.onrender.com/portfolio/${email}`;

                // Log live link creation
                console.log("Live link created:", liveLink);

                // Save the portfolio
                const portfolio = {
                    email,
                    liveLink,
                    portfolioData: sanitizedPortfolioData,
                    createdAt: new Date(),
                };
                await PortfolioZColletion.insertOne(portfolio);

                // Log portfolio saved successfully
                console.log("Portfolio saved for:", email);

                res.json({ liveLink });
            } catch (error) {
                // Log the error
                console.error("Error publishing portfolio:", error);
                res.status(500).json({ message: "Failed to publish portfolio." });
            }
        });

        // GET API: Serve Portfolio by Email
        app.get("/publishPortfolio/:email",  async (req, res) => {
            try {
                const { email } = req.params;

                // Log incoming request for portfolio
                console.log("Fetching portfolio for email:", email);

                const portfolio = await PortfolioZColletion.findOne({ email });
                if (!portfolio) {
                    console.log("Portfolio not found for email:", email);
                    return res.status(404).json({ message: "Portfolio not found." });
                }

                // Log found portfolio
                console.log("Portfolio found for email:", email);

                res.json({ portfolioData: portfolio.portfolioData });
            } catch (error) {
                // Log the error
                console.error("Error fetching portfolio:", error);
                res.status(500).json({ message: "Failed to fetch portfolio." });
            }
        });





















        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);



app.get('/', (req, res) => {
    res.send("Portfolio Z is Running !");

})

app.listen(port, () => {
    console.log(`Portfolio Z app is listening on port ${port}`)
})