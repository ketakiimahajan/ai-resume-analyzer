import { useEffect, useState } from "react";
import { usePuterStore } from "~/lib/puter";
import {useParams, useNavigate, Link} from "react-router"
import Summary from "~/components/feedback/Summary";
import ATS from "~/components/feedback/ATS";
import Details from "~/components/feedback/Details";

export const meta = () => ([
    {title: 'Resumind | Review'},
    {name: 'description', content: 'Detailed overview of your resume'},
])

const Resume = () => {
    const {auth, isLoading, fs, kv} = usePuterStore();
    const {id} = useParams();
    const [imageUrl, setImageUrl] = useState<string>();
    const [resumeUrl, setResumeUrl] = useState<string>();
    const [feedback, setFeedback] = useState<any>();
    const navigate = useNavigate();

    useEffect(() => {
        if (!isLoading && !auth.isAuthenticated) {
            navigate(`/auth?next=/resume/${id}`);
        }
    }, [isLoading, auth.isAuthenticated, navigate, id])

    useEffect(() => {
        const loadResume = async () => {
            try {
                console.log("Loading resume with ID:", id);
                
                const resume = await kv.get(`resume:${id}`);
                console.log("KV get result:", resume);

                if (!resume) {
                    console.error("No resume found for ID:", id);
                    return;
                }

                const data = JSON.parse(resume);
                console.log("Parsed resume data:", data);

                // Load PDF
                const resumeBlob = await fs.read(data.resumePath);
                if (!resumeBlob) {
                    console.error("Failed to read resume file");
                    return;
                }

                const pdfBlob = new Blob([resumeBlob], {type: 'application/pdf'});
                const pdfUrl = URL.createObjectURL(pdfBlob);
                setResumeUrl(pdfUrl);
                console.log("Resume URL created:", pdfUrl);

                // Load Image - FIXED: Check for both imageUrl and imagePath
                if (data.imageUrl) {
                    // If URL is stored directly, use it
                    setImageUrl(data.imageUrl);
                    console.log("Using stored imageUrl:", data.imageUrl);
                } else if (data.imagePath) {
                    // Otherwise, read the image file
                    const imageBlob = await fs.read(data.imagePath);
                    if (imageBlob) {
                        const imgUrl = URL.createObjectURL(imageBlob);
                        setImageUrl(imgUrl);
                        console.log("Created imageUrl from blob:", imgUrl);
                    } else {
                        console.error("Failed to read image file");
                    }
                } else {
                    console.error("No image path or URL found in data");
                }

                setFeedback(data.feedback);
                console.log("Feedback loaded:", data.feedback);
            } catch (error) {
                console.error("Error loading resume:", error);
            }
        }

        if (id) {
            loadResume();
        }
    }, [id, kv, fs]);

    return (
        <main className="pt-0!">
            <nav className="resume-nav">
                <Link to="/" className="back-button">
                    <img src="/icons/back.svg" alt="back" className="w-2.5 h-2.5" />
                    <span className="text-gray-800 text-sm font-semibold">Back to Homepage</span>
                </Link>
            </nav>
            
            <div className="flex flex-row w-full max-lg:flex-col-reverse">
                <section className="feedback-section bg-[url('/images/bg-small.svg')] bg-cover h-screen sticky top-0 items-center justify-center">
                    {imageUrl && resumeUrl && (
                        <div className="animate-in fade-in duration-1000 gradient-border max-sm:m-0 h-[90%] max-wxl:h-fit w-fit">
                            <a href={resumeUrl} target="_blank" rel="noopener noreferrer">
                                <img 
                                    src={imageUrl}
                                    className="w-full h-full object-contain rounded-2xl"
                                    alt="resume"
                                />
                            </a>
                        </div>
                    )}
                </section>
                <section className="feedback-section">
                    <h2 className="text-4xl text-black! font-bold">Resume Review</h2>
                    {feedback ? (
                        <div className="flex flex-col gap-8 animate-in fade-in duration-1000">
                            {/* <pre>{JSON.stringify(feedback, null, 2)}</pre> */}
                            <Summary feedback={feedback} />
                            <ATS score={feedback.ATS.score || 0} suggestions={feedback.ATS.tips || []} />
                            <Details feedback={feedback}/>
                        </div>
                    ) : (
                        <img src="/images/resume-scan-2.gif" className="w-full" alt="loading" />
                    )}
                </section>
            </div>
        </main>
    )
}

export default Resume