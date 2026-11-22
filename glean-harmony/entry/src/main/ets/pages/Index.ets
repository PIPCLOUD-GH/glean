import { router } from '@kit.ArkUI';

@Entry
@Component
struct Index {
  @State msg: string = 'Glean';

  aboutToAppear(): void {
    this.go();
  }

  private go(): void {
    router.replaceUrl({ url: 'pages/WebViewPage' });
  }

  build() {
    Column() {
      Text('Glean').fontSize(20).fontColor('#374151')
    }
    .width('100%').height('100%').justifyContent(FlexAlign.Center).backgroundColor('#F5F3EE')
  }
}
