import React from 'react';
import {MuiThemeProvider, withStyles} from '@material-ui/core/styles';
import AppBar from '@material-ui/core/AppBar';
import Tabs from '@material-ui/core/Tabs';
import Tab from '@material-ui/core/Tab';
import GenericApp from '@iobroker/adapter-react/GenericApp';
import Loader from '@iobroker/adapter-react/Components/Loader'
import IconButton from '@material-ui/core/IconButton';
import RefreshIcon from '@material-ui/icons/Refresh';
import I18n from '@iobroker/adapter-react/i18n';
import TabOptions from './Tabs/Options';
import TabObjects from './Tabs/Objects';

const styles = theme => ({
    root: {},
    tabContent: {
        padding: 10,
        height: 'calc(100% - 64px - 48px - 20px)',
        overflow: 'auto'
    },
    tabContentIFrame: {
        padding: 10,
        height: 'calc(100% - 64px - 48px - 20px - 38px)',
        overflow: 'auto'
    }
});

const roles = ['windows', 'temperature', 'gas', 'light', 'motion'];

class App extends GenericApp {
    constructor(props) {
        const extendedProps = {};
        extendedProps.translations = {
            'en': require('./i18n/en'),
            'de': require('./i18n/de'),
            'ru': require('./i18n/ru'),
            'pt': require('./i18n/pt'),
            'nl': require('./i18n/nl'),
            'fr': require('./i18n/fr'),
            'it': require('./i18n/it'),
            'es': require('./i18n/es'),
            'pl': require('./i18n/pl'),
            'zh-cn': require('./i18n/zh-cn'),
        };
        extendedProps.doNotLoadAllObjects = true;
        extendedProps.adapterName = 'telemetry';

        super(props, extendedProps);
    }

    getSelectedTab() {
        const tab = this.state.selectedTab;
        if (!tab || tab === 'undefined' || tab === 'options') {
            return 0;
        } else
        if (tab === 'objects') {
            return 1;
        }
    }

    async onPrepareLoad(settings) {
        let telemetryObjects = new Object();
        for (let i in settings.telemetryObjects ) {
            let _id = settings.telemetryObjects[i];
            telemetryObjects[_id] = await this.socket.getObject(_id);
        }
        this.setState({telemetryObjects: telemetryObjects});
    }

    onPrepareSave() {
        Object.keys(this.state.telemetryObjects).forEach(_id => 
            this.socket.setObject(_id, this.state.telemetryObjects[_id])
        );
    }

    updateTelemetryObject = (data) => {
        let newObjects = JSON.parse(JSON.stringify(this.state.telemetryObjects));
        newObjects[data.id].common.custom['telemetry.0'].ignore = data.ignore;
        newObjects[data.id].common.custom['telemetry.0'].debounce = data.debounce;
        this.setState({telemetryObjects: newObjects, changed: true});
    }

    render() {
        if (!this.state.loaded || !this.state.telemetryObjects) {
            return <MuiThemeProvider theme={this.state.theme}>
                <Loader theme={this.state.themeType}/>
            </MuiThemeProvider>;
        }

        console.log(this.state);

        this.socket.getObject('system.adapter.telemetry.0').then(result => console.log(result));

        return <MuiThemeProvider theme={this.state.theme}>
            <div className="App" style={{background: this.state.themeType === 'dark' ? '#000' : '#FFF'}}>
                <AppBar position="static">

                    <Tabs value={this.getSelectedTab()} onChange={(e, index) => this.selectTab(e.target.parentNode.dataset.name, index)}>
                        <Tab label={I18n.t('Options')} data-name="options" />
                        <Tab label={I18n.t('Objects')}  data-name="objects" />
                        <IconButton onClick={() => this.onPrepareLoad(this.state.native)}>
                            <RefreshIcon/>
                        </IconButton>
                    </Tabs>
                </AppBar>

                <div className={this.isIFrame ? this.props.classes.tabContentIFrame : this.props.classes.tabContent}>
                    {(this.state.selectedTab === 'options' || !this.state.selectedTab) && (<TabOptions
                        key="options"
                        common={this.common}
                        socket={this.socket}
                        native={this.state.native}
                        theme={this.state.themeType}
                        onError={text => this.setState({errorText: text})}
                        onLoad={native => this.onLoadConfig(native)}
                        instance={this.instance}
                        adapterName={this.adapterName}
                        onChange={(attr, value, cb) => this.updateNativeValue(attr, value, cb)}
                        roles={roles}
                    />)}
                    {this.state.selectedTab === 'objects' && <TabObjects
                        key="resources"
                        common={this.common}
                        socket={this.socket}
                        telemetryObjects={this.state.telemetryObjects}
                        themeType={this.state.themeType}
                        attributeName="resources"
                        theme={this.state.theme}
                        native={this.state.native}
                        onError={text => this.setState({errorText: text})}
                        instance={this.instance}
                        adapterName={this.adapterName}
                        onChange={(attr, value, cb) => this.updateNativeValue(attr, value, cb)}
                        updateTelemetryObject={this.updateTelemetryObject}
                    />}
                </div>
                {this.renderError()}
                {this.renderSaveCloseButtons()}
            </div>
        </MuiThemeProvider>;
    }
}

export default withStyles(styles)(App);
