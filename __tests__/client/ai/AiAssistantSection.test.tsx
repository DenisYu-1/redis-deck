import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AiAssistantSection } from '@/pages/Ai/AiAssistantSection';
import * as api from '@/services/apiService';

jest.mock('@/services/apiService');
const mocked = jest.mocked(api);

const settings: api.AiModelSettings = {
    mode: 'api',
    provider: 'anthropic',
    model: 'claude-sonnet-5-5',
    models: ['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5'],
    keyLast4: null,
    ready: false,
    baseUrl: '',
    localUrl: '',
    localModel: '',
    agent: 'claude',
    agents: [],
    defaultModel: 'claude-sonnet-5-5'
};

test('picks a model, tests a typed key, saves it and only ever shows its last four', async () => {
    const user = userEvent.setup();
    mocked.getAiModel.mockResolvedValue(settings);
    mocked.testAiModel.mockResolvedValue({
        ok: false,
        title: 'Anthropic returned 401',
        detail: 'invalid x-api-key'
    });
    mocked.saveAiModel.mockResolvedValue({
        ...settings,
        model: 'claude-opus-5-5',
        keyLast4: '9F2c',
        ready: true
    });
    render(<AiAssistantSection />);

    const key = await screen.findByLabelText('API key');
    expect(key).toHaveAttribute('type', 'password');
    expect(key).toHaveAttribute('placeholder', 'Paste your key');
    expect(screen.getByRole('radio', { name: /API key/ })).toBeChecked();
    expect(screen.getByText('No key saved')).toBeVisible();

    await user.selectOptions(screen.getByLabelText('Model'), 'claude-opus-5-5');
    await user.type(key, 'sk-ant-typed');
    await user.click(screen.getByRole('button', { name: 'Test' }));

    const draft = {
        mode: 'api',
        provider: 'anthropic',
        model: 'claude-opus-5-5',
        baseUrl: '',
        localUrl: '',
        localModel: '',
        agent: 'claude',
        agentPath: '',
        agentArgs: '',
        apiKey: 'sk-ant-typed'
    };
    expect(mocked.testAiModel).toHaveBeenCalledWith(draft);
    expect(await screen.findByRole('status')).toHaveTextContent(
        'Anthropic returned 401invalid x-api-key'
    );
    expect(mocked.saveAiModel).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(mocked.saveAiModel).toHaveBeenCalledWith(draft);
    await waitFor(() => expect(key).toHaveValue(''));
    expect(key).toHaveAttribute(
        'placeholder',
        'Saved: sk-ant-…9F2c — type to replace'
    );
    expect(screen.getByText('Anthropic · claude-opus-5-5')).toBeVisible();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
});

test('shows a successful test of the stored key', async () => {
    const user = userEvent.setup();
    mocked.getAiModel.mockResolvedValue({
        ...settings,
        keyLast4: '9F2c',
        ready: true
    });
    mocked.testAiModel.mockResolvedValue({
        ok: true,
        title: 'Anthropic replied in 40 ms',
        detail: 'Model claude-sonnet-5-5 with tool use.'
    });
    render(<AiAssistantSection />);

    await user.click(await screen.findByRole('button', { name: 'Test' }));

    expect(mocked.testAiModel).toHaveBeenCalledWith({
        mode: 'api',
        provider: 'anthropic',
        model: 'claude-sonnet-5-5',
        baseUrl: '',
        localUrl: '',
        localModel: '',
        agent: 'claude',
        agentPath: '',
        agentArgs: '',
        apiKey: ''
    });
    expect(await screen.findByRole('status')).toHaveClass('ok');
});

test('switches between the API key providers and the Local model', async () => {
    const user = userEvent.setup();
    const compatible: api.AiModelSettings = {
        ...settings,
        provider: 'openai-compatible',
        model: 'mixtral',
        baseUrl: 'https://llm.example.com/v1',
        keyLast4: '7Qp1',
        ready: true
    };
    mocked.getAiModel.mockResolvedValue(compatible);
    mocked.listAiLocalModels.mockResolvedValue(['qwen', 'llama']);
    mocked.saveAiModel.mockResolvedValue({
        ...compatible,
        mode: 'local',
        localUrl: 'http://box:11434',
        localModel: 'llama'
    });
    render(<AiAssistantSection />);

    const key = await screen.findByLabelText('API key');
    const baseUrl = screen.getByLabelText('Base URL');
    const saved = 'Saved: …7Qp1 — type to replace';
    expect(key).toHaveAttribute('placeholder', saved);
    expect(screen.getByLabelText('Model')).toHaveValue('mixtral');
    expect(screen.getByText('OpenAI-compatible · mixtral')).toBeVisible();

    // The saved key belongs to the saved Base URL only.
    await user.type(baseUrl, '2');
    expect(key).toHaveAttribute('placeholder', 'Paste your key');
    await user.type(key, 'sk-typed');
    await user.type(baseUrl, '{Backspace}');
    expect(key).toHaveValue('');
    expect(key).toHaveAttribute('placeholder', saved);

    // Nor does a typed key follow to another provider.
    await user.type(key, 'sk-typed');
    await user.selectOptions(screen.getByLabelText('Provider'), 'openai');
    expect(key).toHaveValue('');
    expect(key).toHaveAttribute('placeholder', 'Paste your key');
    expect(screen.queryByLabelText('Base URL')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Model')).toHaveValue('');
    expect(screen.getByLabelText('Model')).toHaveAttribute(
        'placeholder',
        'model id'
    );
    await user.selectOptions(screen.getByLabelText('Provider'), 'anthropic');
    expect(screen.getByLabelText('Model')).toHaveValue('claude-sonnet-5-5');

    await user.click(screen.getByRole('radio', { name: /Local model/ }));
    expect(screen.queryByLabelText('API key')).not.toBeInTheDocument();
    expect(screen.getByText(/multi-step tool use/)).toBeVisible();
    expect(mocked.listAiLocalModels).not.toHaveBeenCalled();
    await user.type(screen.getByLabelText('Server URL'), 'http://box:11434');
    await user.tab();

    expect(mocked.listAiLocalModels).toHaveBeenCalledWith('http://box:11434');
    const model = screen.getByLabelText('Model');
    await waitFor(() => expect(model).toHaveValue('qwen'));
    await user.selectOptions(model, 'llama');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(mocked.saveAiModel).toHaveBeenCalledWith(
        expect.objectContaining({
            mode: 'local',
            localUrl: 'http://box:11434',
            localModel: 'llama',
            apiKey: ''
        })
    );
    expect(await screen.findByText('Local model · llama')).toBeVisible();
});

const claude: api.AiAgent = {
    id: 'claude',
    name: 'Claude Code',
    command: 'claude',
    defaultArgs: '-p {mcp_config}',
    path: '',
    args: '-p {mcp_config}',
    found: '/home/me/.local/bin/claude'
};

test('sets up the Local agent: found or missing, path and Arguments', async () => {
    const user = userEvent.setup();
    mocked.getAiModel.mockResolvedValue({ ...settings, agents: [claude] });
    mocked.testAiModel.mockResolvedValue({
        ok: true,
        title: 'Claude Code answered in 4.2 s',
        detail: 'It listed 13 Redis Deck MCP tools.'
    });
    mocked.saveAiModel.mockResolvedValue({
        ...settings,
        mode: 'agent',
        agents: [claude],
        ready: true
    });
    render(<AiAssistantSection />);

    await user.click(await screen.findByRole('radio', { name: /Local agent/ }));
    expect(screen.getByRole('radio', { name: /Claude Code/ })).toBeChecked();
    expect(screen.getByText('/home/me/.local/bin/claude')).toBeVisible();
    expect(screen.getByText('found')).toBeVisible();
    expect(screen.queryByLabelText('API key')).not.toBeInTheDocument();
    expect(screen.getByText(/access to the host/)).toBeVisible();
    expect(screen.getByText(/Running in Docker/)).toBeVisible();

    const args = screen.getByLabelText('Arguments');
    expect(args).toHaveValue('-p {mcp_config}');
    await user.type(args, ' --model haiku');
    await user.type(screen.getByLabelText('Path'), '/opt/claude');
    await user.click(screen.getByRole('button', { name: 'Test' }));

    expect(mocked.testAiModel).toHaveBeenLastCalledWith(
        expect.objectContaining({
            mode: 'agent',
            agent: 'claude',
            agentPath: '/opt/claude',
            agentArgs: '-p {mcp_config} --model haiku'
        })
    );
    expect(await screen.findByRole('status')).toHaveTextContent(
        'Claude Code answered in 4.2 sIt listed 13 Redis Deck MCP tools.'
    );

    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Claude Code · local agent')).toBeVisible();
});

test('selects another agent, with its own Arguments and hint', async () => {
    const user = userEvent.setup();
    const codex: api.AiAgent = {
        id: 'codex',
        name: 'Codex CLI',
        command: 'codex',
        defaultArgs: 'exec --sandbox read-only',
        path: '',
        args: 'exec --sandbox read-only',
        found: null
    };
    mocked.getAiModel.mockResolvedValue({
        ...settings,
        mode: 'agent',
        agents: [claude, codex]
    });
    render(<AiAssistantSection />);

    expect(await screen.findByText(/points the agent/)).toBeVisible();
    await user.click(screen.getByRole('radio', { name: /Codex CLI/ }));

    expect(screen.getByLabelText('Arguments')).toHaveValue(
        'exec --sandbox read-only'
    );
    expect(screen.queryByText(/points the agent/)).not.toBeInTheDocument();
    expect(screen.getByText(/adds its MCP server/)).toBeVisible();
});

test('shows an agent whose CLI is missing', async () => {
    mocked.getAiModel.mockResolvedValue({
        ...settings,
        mode: 'agent',
        agents: [{ ...claude, found: null }]
    });
    render(<AiAssistantSection />);

    expect(await screen.findByText('missing')).toBeVisible();
    expect(screen.getByText('claude not found on PATH')).toBeVisible();
    expect(screen.getByText('claude not found')).toBeVisible();
});
