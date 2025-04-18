import type {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class OpenSearchApi implements ICredentialType {
	name = 'openSearchApi';

	displayName = 'OpenSearch API';

	documentationUrl = 'https://docs.n8n.io/credentials/openSearchApi/';

	properties: INodeProperties[] = [
		{
			displayName: 'Username',
			name: 'username',
			type: 'string',
			default: '',
		},
		{
			displayName: 'Password',
			name: 'password',
			type: 'string',
			typeOptions: {
				password: true,
			},
			default: '',
		},
		{
			displayName: 'Base URL',
			name: 'baseUrl',
			type: 'string',
			default: '',
			required: true,
			placeholder: 'https://mydeployment.es.us-central1.gcp.cloud.es.io:9243',
			description: "Referred to as Elasticsearch 'endpoint' in the Elastic deployment dashboard",
		},
		{
			displayName: 'Ignore SSL Issues',
			name: 'ignoreSSLIssues',
			type: 'boolean',
			default: false,
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			auth: {
				username: '={{$credentials.username}}',
				password: '={{$credentials.password}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{$credentials.baseUrl}}',
			url: '/_count?human=false',
			skipSslCertificateValidation: '={{$credentials.ignoreSSLIssues}}',
		},
	};
}
