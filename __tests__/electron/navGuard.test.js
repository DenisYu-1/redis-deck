const { isSafeExternalUrl, isSameOrigin } = require('../../electron/navGuard');

describe('navGuard', () => {
    it('allows only http(s) externally', () => {
        expect(isSafeExternalUrl('https://example.com/x')).toBe(true);
        expect(isSafeExternalUrl('http://example.com')).toBe(true);
        expect(isSafeExternalUrl('file:///etc/passwd')).toBe(false);
        expect(isSafeExternalUrl('smb://host/share')).toBe(false);
        expect(isSafeExternalUrl('javascript:alert(1)')).toBe(false);
        expect(isSafeExternalUrl('not a url')).toBe(false);
    });

    it('matches origin only', () => {
        const o = 'http://127.0.0.1:5173/';
        expect(isSameOrigin('http://127.0.0.1:5173/keys?x=1', o)).toBe(true);
        expect(isSameOrigin('http://127.0.0.1:5174/', o)).toBe(false);
        expect(isSameOrigin('https://evil.com/', o)).toBe(false);
        expect(isSameOrigin('garbage', o)).toBe(false);
    });
});
