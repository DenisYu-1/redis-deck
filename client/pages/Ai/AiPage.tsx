import { isDesktop } from '@/utils/desktopTitleBar';
import { AiAccessGrid } from './AiAccessGrid';
import { AiActivityLog } from './AiActivityLog';
import { AiClientsSection } from './AiClientsSection';
import { AiMayDoSection } from './AiMayDoSection';
import { AiToolsSection } from './AiToolsSection';

/**
 * AI access page: the rules for the assistant and AI clients alike (access,
 * hidden fields, tools, activity log), plus the MCP server on Desktop.
 */
export function AiPage() {
    return (
        <div className="scroll">
            <div className="aiwrap">
                <div className="aihead">
                    <h1>AI access</h1>
                    <p>
                        Decide what the assistant and AI clients may do on each
                        Connection, and see every call they make.
                    </p>
                </div>
                <div className="aigrid">
                    <div className="aicol">
                        <AiAccessGrid />
                        <AiMayDoSection />
                        {isDesktop() && <AiClientsSection />}
                    </div>
                    <div className="aicol">
                        <AiToolsSection />
                    </div>
                </div>
                <AiActivityLog />
            </div>
        </div>
    );
}
