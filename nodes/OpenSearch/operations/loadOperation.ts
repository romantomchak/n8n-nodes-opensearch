import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import type { Embeddings } from '@langchain/core/embeddings';
import type { OpenSearchVectorStore } from '@langchain/community/dist/vectorstores/opensearch';
import type { VectorStoreNodeArgs } from '../utils/types';
import { getMetadataFiltersValues } from '../utils/helpers';

export async function handleLoadOperation<T extends OpenSearchVectorStore = OpenSearchVectorStore>(
	context: IExecuteFunctions,
	args: VectorStoreNodeArgs<T>,
	embeddings: Embeddings,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	const filter = getMetadataFiltersValues(context, itemIndex);
	const vectorStore = await args.getVectorStoreClient(
		context,
		embeddings,
		itemIndex,
	);

	// Get the search parameters from the node
	const prompt = context.getNodeParameter('prompt', itemIndex) as string;
	const topK = context.getNodeParameter('topK', itemIndex, 4) as number;
	const includeDocumentMetadata = context.getNodeParameter(
		'includeDocumentMetadata',
		itemIndex,
		true,
	) as boolean;

	// Embed the prompt to prepare for vector similarity search
	const embeddedPrompt = await embeddings.embedQuery(prompt);

	// Get the most similar documents to the embedded prompt
	const docs = await vectorStore.similaritySearchVectorWithScore(embeddedPrompt, topK, filter);

	// Format the documents for the output
	return docs.map(([doc, score]) => {
		const document = {
			pageContent: doc.pageContent,
			...(includeDocumentMetadata ? { metadata: doc.metadata } : {}),
		};

		return {
			json: { document, score },
			pairedItem: {
				item: itemIndex,
			},
		};
	});
}
