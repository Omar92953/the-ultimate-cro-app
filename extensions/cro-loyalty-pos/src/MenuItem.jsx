import { render } from 'preact';

export default async () => {
  render(<Extension />, document.body);
};

/** "Use points" in the customer's action menu. */
function Extension() {
  return <s-button onClick={() => shopify.action.presentModal()}>{shopify.i18n.translate('use')}</s-button>;
}
