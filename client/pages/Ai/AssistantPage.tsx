import { AiAssistantSection } from './AiAssistantSection';

/** The built-in assistant: which model answers in the chat. */
export function AssistantPage() {
    return (
        <div className="scroll">
            <div className="aiwrap">
                <div className="aihead">
                    <h1>Assistant</h1>
                    <p>Choose the model behind the built-in AI assistant.</p>
                </div>
                <AiAssistantSection />
            </div>
        </div>
    );
}
