import { Layout } from '../components/Layout';

export function Imprint() {
  return (
    <Layout page="imprint" contentClass="content--contact">
      <div className="col-label">
        <span className="label-kicker">Legal</span>
        <h1 className="label-heading">Im<br />print.</h1>
        <p className="label-sub">
          Information in accordance<br />
          with § 5 TMG (German<br />
          Telemedia Act).
        </p>
      </div>

      <div className="col-fields">
        <div className="field">
          <span className="field-idx">001</span>
          <div>
            <div className="field-label">Responsible</div>
            <div className="field-value">Conrad Löffler</div>
          </div>
        </div>

        <div className="field">
          <span className="field-idx">002</span>
          <div>
            <div className="field-label">Address</div>
            <div className="field-value is-mute">Hamburg, Germany</div>
          </div>
        </div>

        <div className="field">
          <span className="field-idx">003</span>
          <div>
            <div className="field-label">Contact</div>
            <div className="field-value">
              <a href="mailto:conrad@connilefleur.de">conrad@connilefleur.de</a>
            </div>
          </div>
        </div>

        <div className="field">
          <span className="field-idx">004</span>
          <div>
            <div className="field-label">Liability</div>
            <div className="field-value is-mute">
              Content created with care.<br />
              No guarantee of accuracy<br />
              or completeness. External<br />
              links are beyond our control.
            </div>
          </div>
        </div>

        <div className="field">
          <span className="field-idx">005</span>
          <div>
            <div className="field-label">Copyright</div>
            <div className="field-value is-mute">
              © 2026 Conrad Löffler.<br />
              All rights reserved.
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
