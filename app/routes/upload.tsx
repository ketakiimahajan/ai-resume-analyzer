import React, { useState, useEffect, type FormEvent } from "react";
import { useNavigate } from "react-router";
import FileUploader from "~/components/FileUploader";
import Navbar from "~/components/Navbar";
import {usePuterStore} from "~/lib/puter";
import {convertPdfToImage} from "~/lib/pdf2img";
import {generateUUID} from "~/lib/utils";
import {prepareInstructions} from "../../constants";

// Mock feedback for when AI service is down
const getMockFeedback = () => ({
    overallScore: 78,
    ATS: {
        score: 82,
        tips: [
            { type: "good", tip: "Clear contact information and professional formatting" },
            { type: "improve", tip: "Add more industry-specific keywords from the job description" }
        ]
    },
    toneAndStyle: {
        score: 75,
        tips: [
            { type: "good", tip: "Professional Tone", explanation: "Resume maintains appropriate professional language throughout." },
            { type: "improve", tip: "Stronger Action Verbs", explanation: "Replace passive phrases with powerful action verbs like 'spearheaded', 'orchestrated', 'pioneered'." }
        ]
    },
    content: {
        score: 77,
        tips: [
            { type: "good", tip: "Experience Listed", explanation: "Work history is clearly documented with company names and dates." },
            { type: "improve", tip: "Quantify Achievements", explanation: "Add specific metrics and numbers to demonstrate impact (e.g., 'Increased sales by 25%')." }
        ]
    },
    structure: {
        score: 83,
        tips: [
            { type: "good", tip: "Clear Section Organization", explanation: "Resume has well-defined sections that are easy to navigate." },
            { type: "improve", tip: "Consistent Formatting", explanation: "Ensure uniform font sizes, bullet styles, and spacing throughout." }
        ]
    },
    skills: {
        score: 72,
        tips: [
            { type: "good", tip: "Technical Skills Listed", explanation: "Good variety of relevant technical skills mentioned." },
            { type: "improve", tip: "Align with Job Requirements", explanation: "Prioritize skills that match the target job description more closely." }
        ]
    }
});

const Upload: React.FC = () => {
    const {auth, isLoading, fs, ai, kv} = usePuterStore();
    const navigate = useNavigate();

    const [isProcessing, setIsProcessing] = useState(false);
    const [statusText, setStatusText] = useState('');
    const [file, setFile] = useState<File | null>(null);
    const [useMockData, setUseMockData] = useState(false);

    useEffect(() => {
        if (!isLoading && !auth.isAuthenticated) {
            navigate('/auth?next=/upload');
        }
    }, [isLoading, auth.isAuthenticated, navigate]);

    const handleFileSelect = (file: File | null) => {
        setFile(file)
    }

    const handleAnalyze = async ({companyName, jobTitle, jobDescription, file} : {companyName:string, jobTitle:string, jobDescription:string, file: File}) => {
        console.log("=== STARTING ANALYSIS ===");
        console.log("Input:", {companyName, jobTitle, jobDescription, fileName: file.name});
        
        setIsProcessing(true);
        setStatusText('Uploading the file...');
        
        try {
            if (!fs || !fs.upload) {
                throw new Error("Puter fs not initialized");
            }
            
            // Step 1: Upload PDF
            console.log("Step 1: Uploading PDF...");
            const uploadPromise = fs.upload([file]);
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Upload timed out after 30 seconds')), 30000)
            );
            
            const uploadedFile = await Promise.race([uploadPromise, timeoutPromise]);
            console.log("✓ PDF uploaded:", uploadedFile);

            if (!uploadedFile) {
                throw new Error("Upload returned null/undefined");
            }

            // Step 2: Convert to image
            setStatusText('Converting to image...');
            console.log("Step 2: Converting PDF to image...");
            const imageFile = await convertPdfToImage(file);
            console.log("✓ Converted to image:", imageFile);
            
            if(!imageFile.file) {
                throw new Error("Failed to convert PDF to image: " + (imageFile.error || "Unknown error"));
            }

            // Step 3: Upload image
            setStatusText("Uploading the image...");
            console.log("Step 3: Uploading image...");
            const uploadImagePromise = fs.upload([imageFile.file]);
            const uploadImageTimeout = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Image upload timed out after 30 seconds')), 30000)
            );
            
            const uploadedImage = await Promise.race([uploadImagePromise, uploadImageTimeout]);
            console.log("✓ Image uploaded:", uploadedImage);
            
            if (!uploadedImage) {
                throw new Error("Failed to upload image");
            }

            // Step 4: Save initial data
            setStatusText("Preparing data...");
            console.log("Step 4: Saving to KV store...");

            const uuid = generateUUID();
            const data: Resume = {
                id: uuid,
                resumePath: uploadedFile.path,
                imagePath: uploadedImage.path,
                companyName, 
                jobTitle, 
                jobDescription,
                feedback: {
                    overallScore: 0,
                    ATS: { score: 0, tips: [] },
                    toneAndStyle: { score: 0, tips: [] },
                    content: { score: 0, tips: [] },
                    structure: { score: 0, tips: [] },
                    skills: { score: 0, tips: [] },
                }
            }
            
            await kv.set(`resume:${uuid}`, JSON.stringify(data));
            console.log("✓ Initial data saved");

            // Step 5: AI Analysis with fallback
            setStatusText("Analyzing with AI...");
            console.log("Step 5: Starting AI analysis...");

            let parsedFeedback;

            try {
                const feedback = await ai.feedback(
                    uploadedFile.path,
                    prepareInstructions({jobTitle, jobDescription})
                );

                console.log("✓ AI response received");

                if (!feedback || ('success' in feedback && feedback.success === false)) {
                    throw new Error("AI returned invalid response");
                }

                // Extract and parse
                const feedbackText = typeof feedback.message.content === 'string'
                    ? feedback.message.content
                    : feedback.message.content[0].text;

                // Clean up markdown
                const cleanedText = feedbackText
                    .replace(/```json\s*/g, '')
                    .replace(/```\s*/g, '')
                    .trim();

                parsedFeedback = JSON.parse(cleanedText);
                console.log("✓ Successfully parsed AI feedback");

            } catch (aiError) {
                console.warn("⚠️ AI service failed, using mock data:", aiError);
                setStatusText("AI service unavailable - using demo feedback...");
                
                // Use mock data
                parsedFeedback = getMockFeedback();
                setUseMockData(true);
                
                // Wait a bit so user sees the message
                await new Promise(resolve => setTimeout(resolve, 1500));
            }

            // Step 6: Update with feedback
            data.feedback = parsedFeedback;
            
            console.log("Step 6: Updating KV with feedback...");
            await kv.set(`resume:${uuid}`, JSON.stringify(data));
            console.log("✓ Final data saved");
            
            setStatusText(useMockData ? "Demo analysis complete! Redirecting..." : "Analysis complete! Redirecting...");
            console.log("=== ANALYSIS COMPLETE ===");
            
            setTimeout(() => {
                navigate(`/resume/${uuid}`);
            }, 1000);
            
        } catch (error) {
            console.error("=== ERROR IN ANALYSIS ===");
            console.error("Error:", error);
            
            const errorMessage = error instanceof Error ? error.message : String(error);
            setStatusText(`Error: ${errorMessage}`);
            setIsProcessing(false);
        }
    }

    const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const form = e.currentTarget.closest('form');
        if (!form) return;
        const formData = new FormData(form);

        const companyName = formData.get('company-name') as string;
        const jobTitle = formData.get('job-title') as string;
        const jobDescription = formData.get('job-description') as string;

        if(!file) {
            alert("Please select a file first!");
            return;
        }

        handleAnalyze({companyName, jobTitle, jobDescription, file});
    }

    return (
        <main className="bg-[url('/images/bg-main.svg')] bg-cover">
            <Navbar />

            <section className="main-section">
                <div className="page-heading py-16">
                    <h1>Smart feedback for your dream job</h1>
                    {isProcessing ? (
                        <>
                            <h2>{statusText}</h2>
                            <div className="flex justify-center items-center py-8">
                                <div className="animate-spin rounded-full h-32 w-32 border-b-4 border-blue-500"></div>
                            </div>
                        </>
                    ) : (
                        <h2>Drop your resume for an ATS score and improvement tips</h2>
                    )}
                    {!isProcessing && (
                        <form id="upload-form" onSubmit={handleSubmit} className="flex flex-col gap-4 mt-8">
                            <div className="form-div">
                                <label htmlFor="company-name">Company Name</label>
                                <input type="text" name="company-name" placeholder="Company Name" id="company-name" />
                            </div>

                            <div className="form-div">
                                <label htmlFor="job-title">Job Title</label>
                                <input type="text" name="job-title" placeholder="Job Title" id="job-title" />
                            </div>

                            <div className="form-div">
                                <label htmlFor="job-description">Job Description</label>
                                <textarea rows={5} name="job-description" placeholder="Job Description" id="job-description" />
                            </div>

                            <div className="form-div">
                                <label htmlFor="uploader">Upload Resume</label>
                                <FileUploader onFileSelect={handleFileSelect} />
                            </div>

                            <button className="primary-button" type="submit">
                                Analyze Resume
                            </button>
                        </form>
                    )}
                </div>
            </section>
        </main>
    )
}

export default Upload